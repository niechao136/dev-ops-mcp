"""
项目与命令领域服务：供 REST API（apis/project.py）与 MCP 工具（tools/）共用。

约定:
- 业务校验失败抛出 ValueError，由调用方（API -> DataResult / MCP -> 文本）转换为各自响应格式
- 函数显式接收 db 会话，事务提交由服务函数内部完成后返回 ORM 对象（已过期前可安全读取）
"""

import asyncio
import re
from datetime import datetime, UTC
from typing import List, Optional, Tuple

from src.dbs.orm import Command, Project


# =====================================================================
# 查询辅助
# =====================================================================
def get_project_by_id(db, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id).first()


def get_project_by_name(db, name: str) -> Optional[Project]:
    return db.query(Project).filter(Project.name == name).first()


def extract_placeholders(script: str) -> List[str]:
    """提取脚本中的 ${param} 占位符（去重排序）"""
    return sorted(set(re.findall(r"\$\{(\w+)\}", script or "")))


# =====================================================================
# 健康检查
# =====================================================================
async def check_project_health(project: Project) -> str:
    """
    快速健康检查（受限超时，用于列表页批量探测）。
    返回: healthy / unhealthy / unknown
    """
    health_cmd = next((c for c in project.commands if c.is_health_check), None)
    if not health_cmd:
        return "unknown"

    command_list = [line.strip() for line in health_cmd.shell_command.splitlines() if line.strip()]
    if not command_list:
        return "unknown"

    from src.utils.executor import execute_shell_script

    try:
        # 与真实执行保持一致：优先使用健康检查命令级 work_dir
        check_work_dir = health_cmd.work_dir or project.work_dir
        for cmd in command_list:
            _, status, _ = await asyncio.wait_for(
                execute_shell_script(cmd, check_work_dir, min(health_cmd.timeout, 30)),
                timeout=35,
            )
            if status != "success":
                return "unhealthy"
        return "healthy"
    except asyncio.TimeoutError:
        return "unhealthy"
    except Exception:
        return "unhealthy"


async def run_health_check_detail(project: Project) -> dict:
    """
    完整健康检查（带每步命令的执行详情，用于"执行健康检查"接口）。
    返回: {"status": ..., "results": [...]}
    可能抛出 ValueError（未配置/脚本为空）。
    """
    health_cmd = next((c for c in project.commands if c.is_health_check), None)
    if not health_cmd:
        raise ValueError("该项目未配置健康检查命令")

    command_list = [line.strip() for line in health_cmd.shell_command.splitlines() if line.strip()]
    if not command_list:
        raise ValueError("健康检查脚本内容为空")

    from src.utils.executor import execute_shell_script

    results = []
    check_work_dir = health_cmd.work_dir or project.work_dir
    for cmd in command_list:
        exit_code, status, log = await execute_shell_script(cmd, check_work_dir, health_cmd.timeout)
        results.append({
            "command": cmd,
            "status": status,
            "exit_code": exit_code,
            "output": log,
        })
        if status != "success":
            break

    overall_status = "healthy" if all(r["status"] == "success" for r in results) else "unhealthy"
    return {"status": overall_status, "results": results}


# =====================================================================
# 项目 CRUD
# =====================================================================
def create_project(
    db,
    name: str,
    work_dir: str,
    description: Optional[str] = None,
    is_active: bool = True,
) -> Project:
    if db.query(Project).filter(Project.name == name).first():
        raise ValueError("项目名称已存在")

    project = Project(
        name=name,
        description=description,
        work_dir=work_dir,
        is_active=is_active,
        created_at=datetime.now(UTC),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(
    db,
    project: Project,
    name: Optional[str] = None,
    description: Optional[str] = None,
    work_dir: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Project:
    # 语义与原 API 保持一致: name/work_dir 为 truthy 才更新，description/is_active 传入即更新
    if name and name != project.name:
        if db.query(Project).filter(Project.name == name).first():
            raise ValueError("项目名称已存在")
        project.name = name

    if description is not None:
        project.description = description
    if work_dir:
        project.work_dir = work_dir
    if is_active is not None:
        project.is_active = is_active

    db.commit()
    return project


def delete_projects(db, ids: List[int]) -> int:
    deleted = db.query(Project).filter(Project.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return deleted


def delete_project_cascade(db, project: Project) -> int:
    """
    级联删除单个项目（含其下属命令配置，ORM 级联）。
    返回被级联删除的命令数量。
    """
    command_count = len(project.commands)
    db.delete(project)
    db.commit()
    return command_count


# =====================================================================
# 命令 CRUD
# =====================================================================
def list_project_commands(db, project_id: int, page: int = 1, size: int = 20) -> Tuple[int, List[Command]]:
    query = db.query(Command).filter(Command.project_id == project_id)
    total = query.count()
    commands = query.offset((page - 1) * size).limit(size).all()
    return total, commands


def get_command_by_id(db, command_id: int) -> Optional[Command]:
    return db.query(Command).filter(Command.id == command_id).first()


def create_command(
    db,
    project_id: int,
    action_type: str,
    shell_command: str,
    description: Optional[str] = None,
    timeout: Optional[int] = None,
    default_params: Optional[dict] = None,
    work_dir: Optional[str] = None,
    is_health_check: bool = False,
    requires_confirm: bool = False,
) -> Command:
    command = Command(
        project_id=project_id,
        action_type=action_type,
        description=description,
        shell_command=shell_command,
        timeout=timeout or 600,
        default_params=default_params,
        work_dir=work_dir,
        is_health_check=is_health_check,
        requires_confirm=requires_confirm,
        created_at=datetime.now(UTC),
    )
    db.add(command)
    db.commit()
    db.refresh(command)
    return command


def update_command(
    db,
    command: Command,
    action_type: Optional[str] = None,
    description: Optional[str] = None,
    shell_command: Optional[str] = None,
    timeout: Optional[int] = None,
    default_params: Optional[dict] = None,
    work_dir: Optional[str] = None,
    is_health_check: Optional[bool] = None,
    requires_confirm: Optional[bool] = None,
) -> Command:
    # 语义与原 API 保持一致: action_type/shell_command/timeout 为 truthy 才更新
    if action_type:
        command.action_type = action_type
    if description is not None:
        command.description = description
    if shell_command:
        command.shell_command = shell_command
    if timeout:
        command.timeout = timeout
    if default_params is not None:
        command.default_params = default_params
    if work_dir is not None:
        command.work_dir = work_dir
    if is_health_check is not None:
        command.is_health_check = is_health_check
    if requires_confirm is not None:
        command.requires_confirm = requires_confirm

    db.commit()
    return command


def delete_commands(db, ids: List[int]) -> int:
    deleted = db.query(Command).filter(Command.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return deleted


def set_health_check(db, command: Command) -> bool:
    """
    设置/取消健康检查命令。同一项目内只允许一个健康检查命令。
    返回设置后的状态（True=已设置为健康检查，False=已取消）。
    """
    if command.is_health_check:
        command.is_health_check = False
        db.commit()
        return False

    db.query(Command).filter(
        Command.project_id == command.project_id,
        Command.is_health_check == True,  # noqa: E712
    ).update({"is_health_check": False})

    command.is_health_check = True
    db.commit()
    return True


# =====================================================================
# 命令执行（异步任务提交）
# =====================================================================
def submit_execute(
    db,
    project_name: str,
    action: str,
    params: Optional[dict],
    actor_type: str,
    actor_id: int,
) -> str:
    """
    校验项目/命令、合并参数并替换占位符后提交异步任务。
    返回 task_id；校验失败抛出 ValueError。
    注意: 调用方需自行完成"项目是否被锁定"的前置检查。
    """
    from src.utils.task_executor import submit_task

    project = db.query(Project).filter(
        Project.name == project_name,
        Project.is_active == True,  # noqa: E712
    ).first()
    if not project:
        raise ValueError(f"找不到激活的项目: {project_name}")

    command = db.query(Command).filter(
        Command.project_id == project.id,
        Command.action_type == action,
    ).first()
    if not command:
        raise ValueError(f"项目 '{project_name}' 未配置 '{action}' 操作。")

    raw_command_text = command.shell_command
    merged_params = {**(command.default_params or {}), **(params or {})}
    if merged_params:
        for key, value in merged_params.items():
            raw_command_text = raw_command_text.replace(f"${{{key}}}", str(value))

    command_list = [line.strip() for line in raw_command_text.splitlines() if line.strip()]
    if not command_list:
        raise ValueError(f"'{action}' 配置的脚本内容为空。")

    command_details = {
        "script": command.shell_command,
        "params": params,
        "default_params": command.default_params,
    }

    return submit_task(
        project_name=project_name,
        action=action,
        commands=command_list,
        work_dir=command.work_dir or project.work_dir,
        timeout=command.timeout,
        actor_type=actor_type,
        actor_id=actor_id,
        command_details=command_details,
    )
