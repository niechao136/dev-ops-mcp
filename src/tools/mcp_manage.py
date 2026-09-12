"""
MCP 管理类工具与资源：让大模型通过 MCP 协议管理项目、命令、公共命令、自动化规则。

读写分离设计:
- 只读工具（scope: resources:read）: list_projects / get_project_detail /
  list_project_commands / search_public_commands / list_automations
- 管理写工具（scope: resources:write）: manage_project / manage_command /
  manage_public_command / manage_automation
- Resources: devops://projects、devops://projects/{project_name}/commands、
  devops://public-commands、devops://public-commands/{name}

安全设计:
- scope 校验: 只读需 resources:read，写操作需 resources:write（旧密钥默认仅有 ops:execute）
- 项目白名单: 所有按项目操作的读写仍受 API Key 的 allowed_projects 约束
- 两段式确认: 所有 delete、以及涉及 shell_command / condition_script 的写入，
  第一次调用只返回"变更预览 + confirm_token"，不落库；LLM 须向用户复述风险并
  征得同意后，携带 confirm_token 二次调用才真正执行
- 审计: 所有写操作写入 audit_logs（actor_type=ai, actor_id=token_id）
"""

import json
import re
from datetime import datetime, UTC
from typing import Any, Dict, List, Literal, Optional

from mcp.types import TextContent

from src.dbs.db import get_db_session
from src.dbs.orm import AuditLog, Automation, Command, Project, PublicCommand
from src.utils.confirm_store import consume_confirm, create_confirm
from src.utils.context import check_project, check_token, get_scopes

MAX_PAGE_SIZE = 50
DEFAULT_PAGE_SIZE = 20


# =====================================================================
# 内部辅助
# =====================================================================
def _json_out(data: Any) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps(data, indent=2, ensure_ascii=False, default=str))]


def _text_out(text: str) -> list[TextContent]:
    return [TextContent(type="text", text=text)]


def _clamp_page(page: int, size: int):
    page = max(1, page)
    size = min(max(1, size), MAX_PAGE_SIZE)
    return page, size


def _placeholders(script: str) -> List[str]:
    return sorted(set(re.findall(r"\$\{(\w+)\}", script or "")))


def _check_read_scope() -> Optional[str]:
    from src.utils.context import require_scope
    return require_scope("resources:read")


def _check_write_scope() -> Optional[str]:
    from src.utils.context import require_scope
    return require_scope("resources:write")


def _perm_error(project_name: str) -> Optional[list[TextContent]]:
    """校验当前 Key 是否有权访问该项目，出错时返回错误响应，否则返回 None"""
    token, is_permitted = check_project(project_name)
    if not token:
        return _text_out("缺少 API Key")
    if not is_permitted:
        return _text_out(f"🚫 权限拒绝: 当前 API Key 无权操作项目 {project_name}")
    return None


def _audit(action_category: str, target_project: Optional[str], details: Dict[str, Any]):
    token = check_token()[0]
    if not token:
        return
    with get_db_session() as db:
        db.add(AuditLog(
            actor_type="ai",
            actor_id=token.id,
            action_category=action_category,
            target_project=target_project,
            action_details=details,
            status="success",
            created_at=datetime.now(UTC),
        ))
        db.commit()


def _confirm_or_proceed(
    action: str,
    needed: bool,
    preview: Dict[str, Any],
    confirm_token: Optional[str],
) -> Optional[list[TextContent]]:
    """
    两段式确认闸门:
    - 不需要确认 -> 返回 None，调用方继续落库
    - 需要确认且已携带有效 confirm_token -> 返回 None（令牌已消费），调用方继续落库
    - 需要确认但没有令牌 / 令牌无效 -> 返回预览响应，调用方终止
    """
    if not needed:
        return None

    if confirm_token:
        consumed = consume_confirm(confirm_token, action)
        if consumed is None:
            return _text_out(
                "❌ confirm_token 无效、已过期（有效期 5 分钟）或与本次操作类型不匹配。\n"
                "请重新发起本次操作以获取新的变更预览和 confirm_token。"
            )
        return None

    token_str = create_confirm(action, preview)
    return _json_out({
        "status": "requires_confirm",
        "message": "⚠️ 本次操作属于高危变更，已生成变更预览，尚未生效。",
        "preview": preview,
        "confirm_token": token_str,
        "next_step": (
            "请向用户完整展示上述变更预览（尤其是脚本内容与删除影响），"
            "在用户明确同意后，携带 confirm_token 再次调用本工具完成变更。"
            "confirm_token 有效期 5 分钟且一次性使用。"
        ),
    })


# =====================================================================
# 注册入口
# =====================================================================
def register_manage_tools(mcp) -> None:
    """将管理类工具与资源注册到 FastMCP 实例上"""

    # -----------------------------------------------------------------
    # 只读工具 1: 项目列表
    # -----------------------------------------------------------------
    @mcp.tool()
    async def list_projects(
        keyword: Optional[str] = None,
        page: int = 1,
        size: int = DEFAULT_PAGE_SIZE,
    ) -> list[TextContent]:
        """
        分页获取被管理的项目列表（含每个项目的命令数量与描述）。

        参数:
        - keyword: 可选，按项目名称或描述模糊搜索
        - page/size: 分页参数，size 最大 50

        使用建议: 需要了解某个项目下有哪些命令与脚本时，先用本工具定位项目，
        再调用 get_project_detail 或 list_project_commands 下钻。
        """
        err = _check_read_scope()
        if err:
            return _text_out(err)
        token, is_all_permitted, allowed_list = check_token()
        page, size = _clamp_page(page, size)

        with get_db_session() as db:
            query = db.query(Project)
            if keyword:
                search = f"%{keyword}%"
                query = query.filter(
                    Project.name.ilike(search) | Project.description.ilike(search)
                )
            if not is_all_permitted:
                if not allowed_list:
                    return _json_out({"total": 0, "page": page, "size": size, "data": []})
                query = query.filter(Project.name.in_(allowed_list))

            total = query.count()
            records = (
                query.order_by(Project.id)
                .offset((page - 1) * size)
                .limit(size)
                .all()
            )
            data = [
                {
                    "name": p.name,
                    "description": p.description,
                    "work_dir": p.work_dir,
                    "is_active": p.is_active,
                    "command_count": len(p.commands),
                    "command_actions": [c.action_type for c in p.commands],
                }
                for p in records
            ]
        return _json_out({"total": total, "page": page, "size": size, "data": data})

    # -----------------------------------------------------------------
    # 只读工具 2: 项目详情（含全部命令定义）
    # -----------------------------------------------------------------
    @mcp.tool()
    async def get_project_detail(project_name: str) -> list[TextContent]:
        """
        获取指定项目的完整详情，包括其下所有命令的定义（脚本内容、超时、参数占位符等）。

        使用建议: 执行操作前或排查问题时调用；只想快速浏览命令列表可用
        list_project_commands。
        """
        err = _check_read_scope()
        if err:
            return _text_out(err)
        if (perm_err := _perm_error(project_name)) is not None:
            return perm_err

        with get_db_session() as db:
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                return _text_out(
                    f"❌ 找不到项目: {project_name}。可调用 list_projects 查看现有项目名称。"
                )
            data = {
                "name": project.name,
                "description": project.description,
                "work_dir": project.work_dir,
                "is_active": project.is_active,
                "created_at": str(project.created_at),
                "commands": [
                    {
                        "id": c.id,
                        "action_type": c.action_type,
                        "description": c.description,
                        "shell_command": c.shell_command,
                        "timeout": c.timeout,
                        "default_params": c.default_params,
                        "work_dir": c.work_dir,
                        "is_health_check": c.is_health_check,
                        "requires_confirm": c.requires_confirm,
                        "placeholders": _placeholders(c.shell_command),
                    }
                    for c in project.commands
                ],
            }
        return _json_out(data)

    # -----------------------------------------------------------------
    # 只读工具 3: 项目命令列表
    # -----------------------------------------------------------------
    @mcp.tool()
    async def list_project_commands(
        project_name: str,
        keyword: Optional[str] = None,
        page: int = 1,
        size: int = DEFAULT_PAGE_SIZE,
    ) -> list[TextContent]:
        """
        分页获取指定项目下的命令列表（含脚本内容与占位符）。

        参数:
        - project_name: 项目名称
        - keyword: 可选，按 action_type 或描述模糊搜索
        """
        err = _check_read_scope()
        if err:
            return _text_out(err)
        if (perm_err := _perm_error(project_name)) is not None:
            return perm_err
        page, size = _clamp_page(page, size)

        with get_db_session() as db:
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                return _text_out(f"❌ 找不到项目: {project_name}")
            query = db.query(Command).filter(Command.project_id == project.id)
            if keyword:
                search = f"%{keyword}%"
                query = query.filter(
                    Command.action_type.ilike(search) | Command.description.ilike(search)
                )
            total = query.count()
            records = query.order_by(Command.id).offset((page - 1) * size).limit(size).all()
            data = [
                {
                    "id": c.id,
                    "action_type": c.action_type,
                    "description": c.description,
                    "shell_command": c.shell_command,
                    "timeout": c.timeout,
                    "default_params": c.default_params,
                    "work_dir": c.work_dir,
                    "is_health_check": c.is_health_check,
                    "requires_confirm": c.requires_confirm,
                    "placeholders": _placeholders(c.shell_command),
                }
                for c in records
            ]
        return _json_out({"total": total, "page": page, "size": size, "data": data})

    # -----------------------------------------------------------------
    # 只读工具 4: 公共命令搜索
    # -----------------------------------------------------------------
    @mcp.tool()
    async def search_public_commands(
        keyword: Optional[str] = None,
        tags: Optional[str] = None,
        page: int = 1,
        size: int = DEFAULT_PAGE_SIZE,
    ) -> list[TextContent]:
        """
        分页搜索公共命令模板库（可复用的命令模板）。

        参数:
        - keyword: 按名称、描述、action_type 模糊搜索
        - tags: 逗号分隔的标签筛选

        使用建议: 需要为新项目添加命令时，优先在此搜索是否已有成熟模板，
        再通过 manage_public_command(operation="import_to_project") 导入微调，
        避免从零编写 Shell 脚本。
        """
        err = _check_read_scope()
        if err:
            return _text_out(err)
        page, size = _clamp_page(page, size)

        from sqlalchemy import or_

        with get_db_session() as db:
            query = db.query(PublicCommand).filter(PublicCommand.is_active == True)  # noqa: E712
            if keyword:
                search = f"%{keyword}%"
                query = query.filter(
                    or_(
                        PublicCommand.name.ilike(search),
                        PublicCommand.description.ilike(search),
                        PublicCommand.action_type.ilike(search),
                    )
                )
            if tags:
                for tag in [t.strip() for t in tags.split(",") if t.strip()]:
                    query = query.filter(PublicCommand.tags.ilike(f"%{tag}%"))
            total = query.count()
            records = (
                query.order_by(PublicCommand.updated_at.desc())
                .offset((page - 1) * size)
                .limit(size)
                .all()
            )
            data = [
                {
                    "id": c.id,
                    "name": c.name,
                    "action_type": c.action_type,
                    "description": c.description,
                    "shell_command": c.shell_command,
                    "timeout": c.timeout,
                    "default_params": c.default_params,
                    "tags": c.tags,
                    "placeholders": _placeholders(c.shell_command),
                }
                for c in records
            ]
        return _json_out({"total": total, "page": page, "size": size, "data": data})

    # -----------------------------------------------------------------
    # 只读工具 5: 自动化规则列表
    # -----------------------------------------------------------------
    @mcp.tool()
    async def list_automations(
        project_name: str,
        page: int = 1,
        size: int = DEFAULT_PAGE_SIZE,
    ) -> list[TextContent]:
        """
        分页获取指定项目下的自动化规则（定时/条件触发），含启用状态与最近执行结果。
        """
        err = _check_read_scope()
        if err:
            return _text_out(err)
        if (perm_err := _perm_error(project_name)) is not None:
            return perm_err
        page, size = _clamp_page(page, size)

        with get_db_session() as db:
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                return _text_out(f"❌ 找不到项目: {project_name}")
            query = db.query(Automation).filter(Automation.project_id == project.id)
            total = query.count()
            records = query.order_by(Automation.id).offset((page - 1) * size).limit(size).all()
            command_map = {
                c.id: c.action_type for c in db.query(Command).filter(Command.project_id == project.id).all()
            }
            data = [
                {
                    "id": a.id,
                    "name": a.name,
                    "trigger_type": a.trigger_type,
                    "cron_expression": a.cron_expression,
                    "condition_script": a.condition_script,
                    "condition_interval": a.condition_interval,
                    "command_id": a.command_id,
                    "command_action": command_map.get(a.command_id, ""),
                    "is_enabled": a.is_enabled,
                    "last_run_time": str(a.last_run_time) if a.last_run_time else None,
                    "last_run_status": a.last_run_status,
                }
                for a in records
            ]
        return _json_out({"total": total, "page": page, "size": size, "data": data})

    # -----------------------------------------------------------------
    # 写工具 1: manage_project
    # -----------------------------------------------------------------
    @mcp.tool()
    async def manage_project(
        operation: Literal["create", "update", "delete"],
        name: str,
        description: Optional[str] = None,
        work_dir: Optional[str] = None,
        is_active: Optional[bool] = None,
        confirm_token: Optional[str] = None,
    ) -> list[TextContent]:
        """
        创建 / 更新 / 删除项目（写操作，需 resources:write scope）。

        参数:
        - operation: create / update / delete
        - name: 项目名称（update/delete 时用于定位项目）
        - description / work_dir / is_active: 仅在 create/update 时生效，未传的字段保持不变

        确认机制:
        - delete 属于高危操作（会级联删除项目下所有命令），第一次调用只返回变更预览
          与 confirm_token；向用户确认后携带 confirm_token 再次调用才真正删除。
        - create / update 直接生效，全部写入审计日志。

        注意: work_dir 是脚本执行的工作目录，修改会影响所有命令的执行路径，请谨慎变更。
        """
        err = _check_write_scope()
        if err:
            return _text_out(err)

        action = f"manage_project:{operation}:{name}"

        if operation == "create":
            with get_db_session() as db:
                if db.query(Project).filter(Project.name == name).first():
                    return _text_out(
                        f"❌ 项目 '{name}' 已存在。如需修改请使用 operation='update'；"
                        f"如需查看详情请调用 get_project_detail。"
                    )
                if not work_dir:
                    return _text_out("❌ 创建项目必须提供 work_dir（服务器上的工作目录绝对路径）。")
                project = Project(
                    name=name,
                    description=description,
                    work_dir=work_dir,
                    is_active=is_active if is_active is not None else True,
                    created_at=datetime.now(UTC),
                )
                db.add(project)
                db.commit()
            _audit("manage_project", name, {"operation": "create", "work_dir": work_dir})
            return _text_out(f"✅ 项目 '{name}' 创建成功。接下来可用 manage_command 为其添加命令。")

        with get_db_session() as db:
            project = db.query(Project).filter(Project.name == name).first()
            if not project:
                return _text_out(f"❌ 找不到项目: {name}。可调用 list_projects 查看现有项目。")

            if operation == "update":
                if description is not None:
                    project.description = description
                if work_dir is not None:
                    project.work_dir = work_dir
                if is_active is not None:
                    project.is_active = is_active
                db.commit()
                _audit("manage_project", name, {
                    "operation": "update",
                    "description": description,
                    "work_dir": work_dir,
                    "is_active": is_active,
                })
                return _text_out(f"✅ 项目 '{name}' 更新成功。")

            # operation == "delete"
            command_count = len(project.commands)
            gate = _confirm_or_proceed(
                action,
                needed=True,
                preview={
                    "operation": "delete_project",
                    "project_name": project.name,
                    "work_dir": project.work_dir,
                    "will_be_deleted": f"项目及其下属 {command_count} 条命令配置（服务器上的文件不会被删除）",
                },
                confirm_token=confirm_token,
            )
            if gate is not None:
                return gate
            db.delete(project)
            db.commit()
            _audit("manage_project", name, {"operation": "delete"})
            return _text_out(f"✅ 项目 '{name}' 已删除（含 {command_count} 条命令配置）。")

    # -----------------------------------------------------------------
    # 写工具 2: manage_command
    # -----------------------------------------------------------------
    @mcp.tool()
    async def manage_command(
        operation: Literal["create", "update", "delete"],
        project_name: str,
        command_id: Optional[int] = None,
        action_type: Optional[str] = None,
        description: Optional[str] = None,
        shell_command: Optional[str] = None,
        timeout: Optional[int] = None,
        default_params: Optional[dict] = None,
        work_dir: Optional[str] = None,
        is_health_check: Optional[bool] = None,
        requires_confirm: Optional[bool] = None,
        confirm_token: Optional[str] = None,
    ) -> list[TextContent]:
        """
        创建 / 更新 / 删除项目命令（写操作，需 resources:write scope）。

        ⚠️ shell_command 是将在服务器上真实执行的 Shell 脚本。请优先调用
        search_public_commands 查找现成模板并通过 manage_public_command 的
        import_to_project 导入微调；确需手写脚本时，先向用户展示脚本内容并征得同意。

        定位命令:
        - update/delete 时用 command_id 定位；未提供 command_id 时可用 action_type 定位
          （项目内 action_type 唯一时才有效）。

        参数:
        - create: 必须提供 action_type 与 shell_command；项目内 action_type 不可重复
        - update: 未传的字段保持不变
        - delete: 删除命令配置（不影响服务器文件）

        确认机制: delete、以及任何携带 shell_command 的写入，均需两段式确认
        （第一次返回预览与 confirm_token，用户同意后携带令牌重试）。
        """
        err = _check_write_scope()
        if err:
            return _text_out(err)
        if (perm_err := _perm_error(project_name)) is not None:
            return perm_err

        with get_db_session() as db:
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                return _text_out(f"❌ 找不到项目: {project_name}。可调用 list_projects 查看现有项目。")

            def _locate():
                if command_id is not None:
                    return db.query(Command).filter(
                        Command.id == command_id, Command.project_id == project.id
                    ).first()
                if action_type:
                    return db.query(Command).filter(
                        Command.project_id == project.id, Command.action_type == action_type
                    ).first()
                return None

            if operation == "create":
                if not action_type or not shell_command:
                    return _text_out("❌ 创建命令必须提供 action_type 与 shell_command。")
                existing = db.query(Command).filter(
                    Command.project_id == project.id, Command.action_type == action_type
                ).first()
                if existing:
                    return _text_out(
                        f"❌ 项目 '{project_name}' 已存在 action_type='{action_type}' 的命令 "
                        f"(id={existing.id})。如需修改请使用 operation='update' 并传入 command_id。"
                    )
                gate = _confirm_or_proceed(
                    f"manage_command:create:{project_name}:{action_type}",
                    needed=True,
                    preview={
                        "operation": "create_command",
                        "project_name": project_name,
                        "action_type": action_type,
                        "final_shell_command": shell_command,
                        "placeholders": _placeholders(shell_command),
                        "timeout": timeout or 600,
                        "default_params": default_params,
                        "work_dir": work_dir or project.work_dir,
                    },
                    confirm_token=confirm_token,
                )
                if gate is not None:
                    return gate
                cmd = Command(
                    project_id=project.id,
                    action_type=action_type,
                    description=description,
                    shell_command=shell_command,
                    timeout=timeout or 600,
                    default_params=default_params,
                    work_dir=work_dir,
                    is_health_check=is_health_check or False,
                    requires_confirm=requires_confirm or False,
                    created_at=datetime.now(UTC),
                )
                db.add(cmd)
                db.commit()
                _audit("manage_command", project_name, {
                    "operation": "create", "action_type": action_type, "script": shell_command,
                })
                return _text_out(
                    f"✅ 命令已创建 (id={cmd.id})。可通过 execute_action(project_name='{project_name}', "
                    f"action='{action_type}') 执行。"
                )

            command = _locate()
            if not command:
                hint = f"（可调用 list_project_commands(project_name='{project_name}') 查看命令 id 与 action_type）"
                return _text_out(f"❌ 未定位到命令: command_id={command_id}, action_type={action_type}。{hint}")

            if operation == "update":
                gate = _confirm_or_proceed(
                    f"manage_command:update:{command.id}",
                    needed=shell_command is not None,
                    preview={
                        "operation": "update_command",
                        "project_name": project_name,
                        "command_id": command.id,
                        "action_type": command.action_type,
                        "old_shell_command": command.shell_command,
                        "new_shell_command": shell_command,
                        "placeholders": _placeholders(shell_command) if shell_command else None,
                    },
                    confirm_token=confirm_token,
                )
                if gate is not None:
                    return gate
                if description is not None:
                    command.description = description
                if shell_command is not None:
                    command.shell_command = shell_command
                if timeout is not None:
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
                _audit("manage_command", project_name, {
                    "operation": "update", "command_id": command.id,
                    "action_type": command.action_type, "new_script": shell_command,
                })
                return _text_out(f"✅ 命令 (id={command.id}) 更新成功。")

            # operation == "delete"
            gate = _confirm_or_proceed(
                f"manage_command:delete:{command.id}",
                needed=True,
                preview={
                    "operation": "delete_command",
                    "project_name": project_name,
                    "command_id": command.id,
                    "action_type": command.action_type,
                    "shell_command": command.shell_command,
                },
                confirm_token=confirm_token,
            )
            if gate is not None:
                return gate
            db.delete(command)
            db.commit()
            _audit("manage_command", project_name, {
                "operation": "delete", "command_id": command.id, "action_type": command.action_type,
            })
            return _text_out(f"✅ 命令 (id={command.id}, action='{command.action_type}') 已删除。")

    # -----------------------------------------------------------------
    # 写工具 3: manage_public_command
    # -----------------------------------------------------------------
    @mcp.tool()
    async def manage_public_command(
        operation: Literal["create", "update", "delete", "import_to_project"],
        name: Optional[str] = None,
        command_id: Optional[int] = None,
        action_type: Optional[str] = None,
        description: Optional[str] = None,
        shell_command: Optional[str] = None,
        timeout: Optional[int] = None,
        default_params: Optional[dict] = None,
        tags: Optional[str] = None,
        is_active: Optional[bool] = None,
        project_name: Optional[str] = None,
        confirm_token: Optional[str] = None,
    ) -> list[TextContent]:
        """
        管理公共命令模板库（写操作，需 resources:write scope）。

        公共命令是可跨项目复用的命令模板。为新项目添加命令时，优先复用模板。

        定位模板: update/delete 用 command_id 或 name 定位。

        参数:
        - create: 必须提供 name、action_type、shell_command；tags 为逗号分隔字符串
        - update: 未传字段保持不变
        - delete: 删除模板
        - import_to_project: 将模板复制为指定项目（project_name）的专属命令，
          可选覆盖 description / timeout；此操作直接生效（复用的是已审核模板）。

        确认机制: delete、以及携带 shell_command 的 create/update 需两段式确认。
        """
        err = _check_write_scope()
        if err:
            return _text_out(err)

        if operation == "import_to_project":
            if not command_id or not project_name:
                return _text_out("❌ import_to_project 必须提供 command_id（模板ID）与 project_name。")
            if (perm_err := _perm_error(project_name)) is not None:
                return perm_err
            with get_db_session() as db:
                tpl = db.query(PublicCommand).filter(
                    PublicCommand.id == command_id, PublicCommand.is_active == True  # noqa: E712
                ).first()
                if not tpl:
                    return _text_out(f"❌ 找不到启用的公共命令模板: id={command_id}。")
                project = db.query(Project).filter(Project.name == project_name).first()
                if not project:
                    return _text_out(f"❌ 找不到项目: {project_name}")
                if db.query(Command).filter(
                    Command.project_id == project.id, Command.action_type == tpl.action_type
                ).first():
                    return _text_out(
                        f"❌ 项目 '{project_name}' 已存在 action_type='{tpl.action_type}' 的命令。"
                        f"如需覆盖请先用 manage_command(operation='delete') 删除旧命令。"
                    )
                cmd = Command(
                    project_id=project.id,
                    action_type=tpl.action_type,
                    description=description or tpl.description,
                    shell_command=tpl.shell_command,
                    timeout=timeout or tpl.timeout,
                    default_params=tpl.default_params,
                    created_at=datetime.now(UTC),
                )
                db.add(cmd)
                db.commit()
            _audit("manage_public_command", project_name, {
                "operation": "import_to_project", "template_id": command_id,
            })
            return _text_out(
                f"✅ 模板 '{tpl.name}' 已导入项目 '{project_name}' (命令 id={cmd.id}, "
                f"action='{tpl.action_type}')。可通过 manage_command(operation='update') 微调后执行。"
            )

        with get_db_session() as db:
            def _locate():
                if command_id is not None:
                    return db.query(PublicCommand).filter(PublicCommand.id == command_id).first()
                if name:
                    return db.query(PublicCommand).filter(PublicCommand.name == name).first()
                return None

            if operation == "create":
                if not name or not action_type or not shell_command:
                    return _text_out("❌ 创建公共命令必须提供 name、action_type 与 shell_command。")
                if db.query(PublicCommand).filter(PublicCommand.name == name).first():
                    return _text_out(f"❌ 公共命令 '{name}' 已存在，如需修改请使用 operation='update'。")
                gate = _confirm_or_proceed(
                    f"manage_public_command:create:{name}",
                    needed=True,
                    preview={
                        "operation": "create_public_command",
                        "name": name,
                        "action_type": action_type,
                        "final_shell_command": shell_command,
                        "placeholders": _placeholders(shell_command),
                        "tags": tags,
                    },
                    confirm_token=confirm_token,
                )
                if gate is not None:
                    return gate
                now = datetime.now(UTC)
                tpl = PublicCommand(
                    name=name,
                    action_type=action_type,
                    description=description,
                    shell_command=shell_command,
                    timeout=timeout or 600,
                    default_params=default_params,
                    tags=tags,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
                db.add(tpl)
                db.commit()
                _audit("manage_public_command", None, {
                    "operation": "create", "name": name, "script": shell_command,
                })
                return _text_out(
                    f"✅ 公共命令 '{name}' 创建成功 (id={tpl.id})。"
                    f"可使用 manage_public_command(operation='import_to_project') 导入到具体项目。"
                )

            template = _locate()
            if not template:
                hint = "（可调用 search_public_commands 查看模板 name 与 id）"
                return _text_out(f"❌ 未定位到公共命令: command_id={command_id}, name={name}。{hint}")

            if operation == "update":
                gate = _confirm_or_proceed(
                    f"manage_public_command:update:{template.id}",
                    needed=shell_command is not None,
                    preview={
                        "operation": "update_public_command",
                        "name": template.name,
                        "old_shell_command": template.shell_command,
                        "new_shell_command": shell_command,
                    },
                    confirm_token=confirm_token,
                )
                if gate is not None:
                    return gate
                for field, value in [
                    ("name", name), ("action_type", action_type), ("description", description),
                    ("shell_command", shell_command), ("timeout", timeout),
                    ("default_params", default_params), ("tags", tags), ("is_active", is_active),
                ]:
                    if value is not None:
                        setattr(template, field, value)
                template.updated_at = datetime.now(UTC)
                db.commit()
                _audit("manage_public_command", None, {
                    "operation": "update", "name": template.name, "new_script": shell_command,
                })
                return _text_out(f"✅ 公共命令 '{template.name}' 更新成功。")

            # operation == "delete"
            gate = _confirm_or_proceed(
                f"manage_public_command:delete:{template.id}",
                needed=True,
                preview={
                    "operation": "delete_public_command",
                    "name": template.name,
                    "action_type": template.action_type,
                    "shell_command": template.shell_command,
                    "note": "已导入到各项目的副本不受影响",
                },
                confirm_token=confirm_token,
            )
            if gate is not None:
                return gate
            db.delete(template)
            db.commit()
            _audit("manage_public_command", None, {"operation": "delete", "name": template.name})
            return _text_out(f"✅ 公共命令 '{template.name}' 已删除。")

    # -----------------------------------------------------------------
    # 写工具 4: manage_automation
    # -----------------------------------------------------------------
    @mcp.tool()
    async def manage_automation(
        operation: Literal["create", "update", "delete", "toggle"],
        project_name: str,
        name: Optional[str] = None,
        automation_id: Optional[int] = None,
        trigger_type: Optional[Literal["cron", "condition"]] = None,
        cron_expression: Optional[str] = None,
        condition_script: Optional[str] = None,
        condition_interval: Optional[int] = None,
        command_action: Optional[str] = None,
        is_enabled: Optional[bool] = None,
        confirm_token: Optional[str] = None,
    ) -> list[TextContent]:
        """
        管理项目自动化规则（写操作，需 resources:write scope）。

        自动化规则支持两种触发方式:
        - cron: 定时触发，cron_expression 为 5 段式 cron 表达式（如 "0 3 * * *"）
        - condition: 条件触发，condition_script 为周期执行的检查脚本，输出非空/非0视为满足

        定位规则: update/delete/toggle 用 automation_id，或用 project_name + name 定位。
        create 时通过 command_action 指定要执行的项目内命令（action_type）。

        参数:
        - create: 必须提供 name、trigger_type、command_action；cron 触发需 cron_expression，
          condition 触发需 condition_script（condition_interval 默认 60 秒）
        - update: 未传字段保持不变
        - toggle: 切换启用/禁用状态，直接生效

        确认机制: delete、以及携带 condition_script 的 create/update 需两段式确认
        （condition_script 会被调度器周期性真实执行）。
        """
        err = _check_write_scope()
        if err:
            return _text_out(err)
        if (perm_err := _perm_error(project_name)) is not None:
            return perm_err

        with get_db_session() as db:
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                return _text_out(f"❌ 找不到项目: {project_name}。")

            def _locate():
                if automation_id is not None:
                    return db.query(Automation).filter(
                        Automation.id == automation_id, Automation.project_id == project.id
                    ).first()
                if name:
                    return db.query(Automation).filter(
                        Automation.project_id == project.id, Automation.name == name
                    ).first()
                return None

            if operation == "create":
                if not name or not trigger_type or not command_action:
                    return _text_out("❌ 创建自动化规则必须提供 name、trigger_type 与 command_action。")
                if trigger_type == "cron" and not cron_expression:
                    return _text_out("❌ 定时触发必须提供 cron_expression（5 段式，如 '0 3 * * *'）。")
                if trigger_type == "condition" and not condition_script:
                    return _text_out("❌ 条件触发必须提供 condition_script。")
                if trigger_type == "cron":
                    parts = cron_expression.split()
                    if len(parts) not in (5, 6):
                        return _text_out(
                            f"❌ cron 表达式格式错误: '{cron_expression}'。应为 5 段式（分 时 日 月 周）或 6 段式。"
                        )
                command = db.query(Command).filter(
                    Command.project_id == project.id, Command.action_type == command_action
                ).first()
                if not command:
                    return _text_out(
                        f"❌ 项目 '{project_name}' 不存在 action='{command_action}' 的命令。"
                        f"可调用 list_project_commands 查看可用命令。"
                    )
                if db.query(Automation).filter(
                    Automation.project_id == project.id, Automation.name == name
                ).first():
                    return _text_out(f"❌ 项目 '{project_name}' 已存在同名规则 '{name}'，请改用 operation='update'。")
                gate = _confirm_or_proceed(
                    f"manage_automation:create:{project.id}:{name}",
                    needed=condition_script is not None,
                    preview={
                        "operation": "create_automation",
                        "project_name": project_name,
                        "name": name,
                        "trigger_type": trigger_type,
                        "cron_expression": cron_expression,
                        "condition_script": condition_script,
                        "command_action": command_action,
                    },
                    confirm_token=confirm_token,
                )
                if gate is not None:
                    return gate
                auto = Automation(
                    project_id=project.id,
                    name=name,
                    trigger_type=trigger_type,
                    cron_expression=cron_expression,
                    condition_script=condition_script,
                    condition_interval=condition_interval or 60,
                    command_id=command.id,
                    is_enabled=is_enabled if is_enabled is not None else True,
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
                db.add(auto)
                db.commit()
                _audit("manage_automation", project_name, {
                    "operation": "create", "name": name, "trigger_type": trigger_type,
                })
                return _text_out(f"✅ 自动化规则 '{name}' 创建成功 (id={auto.id})。")

            rule = _locate()
            if not rule:
                hint = f"（可调用 list_automations(project_name='{project_name}') 查看规则 id 与 name）"
                return _text_out(f"❌ 未定位到自动化规则: automation_id={automation_id}, name={name}。{hint}")

            if operation == "update":
                gate = _confirm_or_proceed(
                    f"manage_automation:update:{rule.id}",
                    needed=condition_script is not None,
                    preview={
                        "operation": "update_automation",
                        "project_name": project_name,
                        "automation_id": rule.id,
                        "old_condition_script": rule.condition_script,
                        "new_condition_script": condition_script,
                    },
                    confirm_token=confirm_token,
                )
                if gate is not None:
                    return gate
                if name:
                    rule.name = name
                if trigger_type:
                    rule.trigger_type = trigger_type
                if cron_expression is not None:
                    rule.cron_expression = cron_expression
                if condition_script is not None:
                    rule.condition_script = condition_script
                if condition_interval is not None:
                    rule.condition_interval = condition_interval
                if command_action:
                    command = db.query(Command).filter(
                        Command.project_id == project.id, Command.action_type == command_action
                    ).first()
                    if not command:
                        return _text_out(f"❌ 项目 '{project_name}' 不存在 action='{command_action}' 的命令。")
                    rule.command_id = command.id
                if is_enabled is not None:
                    rule.is_enabled = is_enabled
                rule.updated_at = datetime.now(UTC)
                db.commit()
                _audit("manage_automation", project_name, {
                    "operation": "update", "automation_id": rule.id,
                })
                return _text_out(f"✅ 自动化规则 (id={rule.id}) 更新成功。")

            if operation == "toggle":
                rule.is_enabled = not rule.is_enabled
                rule.updated_at = datetime.now(UTC)
                db.commit()
                _audit("manage_automation", project_name, {
                    "operation": "toggle", "automation_id": rule.id,
                    "is_enabled": rule.is_enabled,
                })
                state = "启用" if rule.is_enabled else "禁用"
                return _text_out(f"✅ 自动化规则 '{rule.name}' 已{state}。")

            # operation == "delete"
            gate = _confirm_or_proceed(
                f"manage_automation:delete:{rule.id}",
                needed=True,
                preview={
                    "operation": "delete_automation",
                    "project_name": project_name,
                    "automation_id": rule.id,
                    "name": rule.name,
                    "trigger_type": rule.trigger_type,
                },
                confirm_token=confirm_token,
            )
            if gate is not None:
                return gate
            db.delete(rule)
            db.commit()
            _audit("manage_automation", project_name, {
                "operation": "delete", "automation_id": rule.id, "name": rule.name,
            })
            return _text_out(f"✅ 自动化规则 '{rule.name}' 已删除。")

    # =================================================================
    # Resources: 低频变化的只读配置，供支持 resource 的客户端直接读取
    # =================================================================
    @mcp.resource("devops://projects", name="项目清单", mime_type="application/json")
    async def resource_projects() -> str:
        """当前节点所有有权限访问的项目清单（静态配置，不含实时健康状态）"""
        token, is_all_permitted, allowed_list = check_token()
        if not token:
            return json.dumps({"error": "缺少 API Key"}, ensure_ascii=False)
        with get_db_session() as db:
            query = db.query(Project)
            if not is_all_permitted:
                query = query.filter(Project.name.in_(allowed_list)) if allowed_list else query.filter(False)
            projects = query.all()
            data = [
                {
                    "name": p.name,
                    "description": p.description,
                    "work_dir": p.work_dir,
                    "is_active": p.is_active,
                    "available_actions": [
                        {
                            "action_type": c.action_type,
                            "description": c.description,
                            "placeholders": _placeholders(c.shell_command),
                        }
                        for c in p.commands
                    ],
                }
                for p in projects
            ]
        return json.dumps(data, indent=2, ensure_ascii=False)

    @mcp.resource("devops://projects/{project_name}/commands", name="项目命令", mime_type="application/json")
    async def resource_project_commands(project_name: str) -> str:
        """指定项目下所有命令的完整定义"""
        token, is_permitted = check_project(project_name)
        if not token:
            return json.dumps({"error": "缺少 API Key"}, ensure_ascii=False)
        if not is_permitted:
            return json.dumps({"error": f"无权访问项目 {project_name}"}, ensure_ascii=False)
        with get_db_session() as db:
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                return json.dumps({"error": f"找不到项目 {project_name}"}, ensure_ascii=False)
            data = [
                {
                    "id": c.id,
                    "action_type": c.action_type,
                    "description": c.description,
                    "shell_command": c.shell_command,
                    "timeout": c.timeout,
                    "default_params": c.default_params,
                    "placeholders": _placeholders(c.shell_command),
                }
                for c in project.commands
            ]
        return json.dumps(data, indent=2, ensure_ascii=False)

    @mcp.resource("devops://public-commands", name="公共命令库", mime_type="application/json")
    async def resource_public_commands() -> str:
        """所有启用的公共命令模板清单（含脚本内容与占位符）"""
        with get_db_session() as db:
            templates = db.query(PublicCommand).filter(
                PublicCommand.is_active == True  # noqa: E712
            ).order_by(PublicCommand.updated_at.desc()).all()
            data = [
                {
                    "id": t.id,
                    "name": t.name,
                    "action_type": t.action_type,
                    "description": t.description,
                    "shell_command": t.shell_command,
                    "timeout": t.timeout,
                    "tags": t.tags,
                    "placeholders": _placeholders(t.shell_command),
                }
                for t in templates
            ]
        return json.dumps(data, indent=2, ensure_ascii=False)

    @mcp.resource("devops://public-commands/{name}", name="公共命令详情", mime_type="application/json")
    async def resource_public_command_detail(name: str) -> str:
        """按名称获取单个公共命令模板的完整定义"""
        with get_db_session() as db:
            template = db.query(PublicCommand).filter(PublicCommand.name == name).first()
            if not template:
                return json.dumps({"error": f"找不到公共命令 {name}"}, ensure_ascii=False)
            data = {
                "id": template.id,
                "name": template.name,
                "action_type": template.action_type,
                "description": template.description,
                "shell_command": template.shell_command,
                "timeout": template.timeout,
                "default_params": template.default_params,
                "tags": template.tags,
                "placeholders": _placeholders(template.shell_command),
            }
        return json.dumps(data, indent=2, ensure_ascii=False)
