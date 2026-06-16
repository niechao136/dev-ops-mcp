import os
import json
import psutil
import socket
import re
from datetime import datetime, timedelta, UTC
from dotenv import load_dotenv
from fastmcp import FastMCP
from mcp.types import TextContent
from pathlib import Path
from typing import Optional

from src.db.db import get_db_session
from src.db.orm import AuditLog, Command, Project
from src.util.context import check_token, check_project, current_mcp_token
from src.util.executor import execute_shell_commands_chain


load_dotenv()


node_suffix = os.getenv("MCP_NODE_NAME") or socket.gethostname()
mcp_name = f"devops-node-{node_suffix}"
mcp = FastMCP(mcp_name)
mcp_app = mcp.http_app(path="/")


# =====================================================================
# Tool 1: 节点全貌探测 (聚合了项目与可用操作)
# =====================================================================
@mcp.tool()
async def get_node_overview() -> list[TextContent]:
    """
    获取当前服务器节点上所有被管理的项目列表，以及每个项目支持的操作(actions)。
    在执行任何其他操作前，应该优先调用此工具了解环境全貌。
    """
    token, is_all_permitted, allowed_list = check_token()
    if not token:
        return [TextContent(type="text", text="缺少 API Key")]

    overview = []
    with get_db_session() as db:
        projects = db.query(Project).filter(Project.is_active == True).all()
        for p in projects:

            if not is_all_permitted and p.name not in allowed_list:
                continue

            project_actions = []
            for cmd in p.commands:
                placeholders = re.findall(r'\$\{(\w+)\}', cmd.shell_command)
                action_info = {
                    "action_type": cmd.action_type,
                    "description": cmd.description,
                    "required_params": placeholders
                }
                project_actions.append(action_info)

            overview.append({
                "project_name": p.name,
                "description": p.description,
                "work_dir": p.work_dir,
                "available_actions": project_actions
            })

    if not overview:
        return [TextContent(type="text", text="当前节点尚未配置任何处于激活状态的项目。")]

    result_text = json.dumps(overview, indent=2, ensure_ascii=False)
    return [TextContent(type="text", text=f"当前节点项目全貌概览:\n{result_text}")]


# =====================================================================
# Tool 2: 执行具体指令
# =====================================================================
@mcp.tool()
async def execute_action(project_name: str, action: str, params: Optional[dict] = None) -> list[TextContent]:
    """
    执行指定项目的特定运维操作（如 start, restart, deploy）。
    执行前请先确保该项目支持该 action。
    
    参数说明:
    - params: 可选参数，字典类型，用于替换命令脚本中的占位符。
        在命令脚本中使用 ${参数名} 格式定义占位符，执行时会被替换为实际值。
        示例: 若脚本包含 'git checkout ${version}'，调用时传入 {"version": "v0.1.0"}
    """
    caller_token = current_mcp_token.get()
    if not caller_token:
        return [TextContent(type="text", text="❌ 无法获取调用者身份信息")]
    
    caller_token_id = caller_token.id
    token, is_permitted = check_project(project_name)
    if not token:
        return [TextContent(type="text", text="缺少 API Key")]

    if not is_permitted:
        return [TextContent(type="text", text=f"🚫 权限拒绝: 当前 API Key 无权操作项目 {project_name}")]

    with get_db_session() as db:
        project = db.query(Project).filter(Project.name == project_name, Project.is_active == True).first()
        if not project:
            return [TextContent(type="text", text=f"❌ 找不到激活的项目: {project_name}")]

        command = db.query(Command).filter(Command.project_id == project.id, Command.action_type == action).first()
        if not command:
            return [TextContent(type="text", text=f"❌ 项目 '{project_name}' 未配置 '{action}' 操作。")]

        raw_command_text = command.shell_command
        
        if params:
            for key, value in params.items():
                placeholder = f"${{{key}}}"
                raw_command_text = raw_command_text.replace(placeholder, str(value))

        command_list = [line.strip() for line in raw_command_text.splitlines() if line.strip()]

        if not command_list:
            return [TextContent(type="text", text=f"❌ '{action}' 配置的脚本内容为空。")]

        is_success, status, output_log = await execute_shell_commands_chain(
            commands=command_list,
            work_dir=project.work_dir,
            total_timeout=command.timeout
        )

        audit = AuditLog(
            actor_type="ai",
            actor_id=caller_token_id,
            action_category="execute_cmd",
            target_project=project.name,
            action_details={"action": action, "script": command.shell_command, "params": params},
            status=status,
            output_log=output_log
        )
        db.add(audit)
        db.commit()

    icon = "✅" if is_success else "❌"
    return [TextContent(type="text", text=f"{icon} 执行 {status}。\n详细日志:\n{output_log}")]


# =====================================================================
# Tool 3: 审查底层脚本
# =====================================================================
@mcp.tool()
async def inspect_script_content(project_name: str, action: str) -> list[TextContent]:
    """
    在排查故障或执行前，查看某个项目的 action 对应到底运行的是什么 Shell 脚本。
    """
    token, is_permitted = check_project(project_name)
    if not token:
        return [TextContent(type="text", text="缺少 API Key")]

    if not is_permitted:
        return [TextContent(type="text", text=f"🚫 权限拒绝: 当前 API Key 无权操作项目 {project_name}")]

    with get_db_session() as db:
        project = db.query(Project).filter(Project.name == project_name).first()
        if not project:
            return [TextContent(type="text", text=f"❌ 找不到项目: {project_name}")]

        command = db.query(Command).filter(Command.project_id == project.id, Command.action_type == action).first()

    if not command:
        return [TextContent(type="text", text=f"❌ 未找到对应指令配置。")]

    result = f"项目: {project_name}\n操作: {action}\n超时设置: {command.timeout}秒\n---\n[底层脚本原文]:\n{command.shell_command}"
    return [TextContent(type="text", text=result)]


# =====================================================================
# Tool 4: 安全读取项目文件 (配置/日志等)
# =====================================================================
@mcp.tool()
async def read_project_file(project_name: str, relative_file_path: str, max_lines: int = 200) -> list[TextContent]:
    """
    读取项目目录下的指定文件内容（如 .env, nginx.conf, app.log）。
    relative_file_path 必须是相对于项目根目录的相对路径。
    """
    token, is_permitted = check_project(project_name)
    if not token:
        return [TextContent(type="text", text="缺少 API Key")]

    if not is_permitted:
        return [TextContent(type="text", text=f"🚫 权限拒绝: 当前 API Key 无权操作项目 {project_name}")]

    with get_db_session() as db:
        project = db.query(Project).filter(Project.name == project_name).first()
        if not project:
            return [TextContent(type="text", text=f"❌ 找不到项目: {project_name}")]

    base_dir = Path(project.work_dir).resolve()
    # 🔴 安全核心：组合路径，并获取其绝对路径
    target_path = (base_dir / relative_file_path).resolve()

    # 🔴 安全核心：检查 target_path 是否真的在 base_dir 内部 (防止 ../../../etc/passwd)
    if not target_path.is_relative_to(base_dir):
        return [TextContent(type="text", text="🚫 安全拦截: 非法路径逃逸尝试！只允许读取项目工作目录内的文件。")]

    if not target_path.is_file():
        return [TextContent(type="text", text=f"❌ 文件不存在: {relative_file_path}")]

    try:
        # 限制读取大小，防止读取几十GB的文件导致大模型崩溃
        file_size_mb = target_path.stat().st_size / (1024 * 1024)
        if file_size_mb > 10:
            return [TextContent(type="text", text=f"❌ 文件过大 ({file_size_mb:.1f}MB)，拒绝读取。请使用具体的 grep 脚本。")]

        with open(target_path, 'r', encoding='utf-8') as f:
            # 只读取最后 N 行 (类似 tail -n)
            lines = f.readlines()
            snippet = "".join(lines[-max_lines:])

        return [TextContent(type="text", text=f"文件 {relative_file_path} 内容 (尾部 {max_lines} 行):\n\n{snippet}")]

    except Exception as e:
        return [TextContent(type="text", text=f"❌ 读取文件失败: {str(e)}")]


# =====================================================================
# Tool 5: 获取节点服务器系统状态
# =====================================================================
@mcp.tool()
async def get_system_metrics() -> list[TextContent]:
    """
    检查当前服务器节点的物理资源使用情况（CPU、内存、磁盘）。
    当应用启动失败、响应慢时，应该首先调用此工具检查服务器健康度。
    """
    cpu_usage = psutil.cpu_percent(interval=1)

    mem = psutil.virtual_memory()
    mem_total_gb = mem.total / (1024 ** 3)
    mem_used_gb = mem.used / (1024 ** 3)

    disk = psutil.disk_usage('/')
    disk_total_gb = disk.total / (1024 ** 3)
    disk_free_gb = disk.free / (1024 ** 3)

    report = (
        f"🖥️ [服务器节点健康度]\n"
        f"- CPU 使用率: {cpu_usage}%\n"
        f"- 内存使用率: {mem.percent}% ({mem_used_gb:.1f}GB / {mem_total_gb:.1f}GB)\n"
        f"- 系统盘可用: {disk_free_gb:.1f}GB / {disk_total_gb:.1f}GB (使用率 {disk.percent}%)\n"
    )

    if cpu_usage > 90 or mem.percent > 90 or disk.percent > 90:
        report += "\n⚠️ 警告: 检测到节点存在资源瓶颈！"

    return [TextContent(type="text", text=report)]


# =====================================================================
# Tool 6: 查阅操作审计日志
# =====================================================================
@mcp.tool()
async def query_audit_logs(project_name: str, hours_ago: int = 24) -> list[TextContent]:
    """
    查询指定项目在过去 N 小时内发生的高危运维操作历史。
    当项目状态异常时，可调用此工具排查是否有人为或AI修改过脚本、执行过错误操作。
    """
    token, is_permitted = check_project(project_name)
    if not token:
        return [TextContent(type="text", text="缺少 API Key")]

    if not is_permitted:
        return [TextContent(type="text", text=f"🚫 权限拒绝: 当前 API Key 无权操作项目 {project_name}")]

    with get_db_session() as db:
        time_threshold = datetime.now(UTC) - timedelta(hours=hours_ago)

        logs = db.query(AuditLog).filter(
            AuditLog.target_project == project_name,
            AuditLog.created_at >= time_threshold
        ).order_by(AuditLog.created_at.desc()).limit(10).all()  # 取最新10条

        if not logs:
            return [TextContent(type="text",
                                text=f"过去 {hours_ago} 小时内，项目 '{project_name}' 没有发生任何记录在案的操作。")]

        report_lines = []
        for log in logs:
            local_time = log.created_at.strftime("%Y-%m-%d %H:%M:%S")
            actor = f"{'人类' if log.actor_type == 'human' else '大模型'}(ID:{log.actor_id})"

            line = f"[{local_time}] {actor} 触发 '{log.action_category}' -> 状态: {log.status}"
            report_lines.append(line)

        full_report = f"项目 '{project_name}' 过去 {hours_ago} 小时操作日志 (最新10条):\n" + "\n".join(report_lines)
        return [TextContent(type="text", text=full_report)]

