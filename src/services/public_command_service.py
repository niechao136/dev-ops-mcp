"""
公共命令模板领域服务：供 REST API（apis/public_command.py）与 MCP 工具（tools/）共用。

约定: 业务校验失败抛出 ValueError，由调用方转换为各自响应格式。
"""

from datetime import datetime, UTC
from typing import List, Optional, Tuple

from src.dbs.orm import Command, Project, PublicCommand


# =====================================================================
# 查询
# =====================================================================
def list_public_commands(
    db,
    keyword: Optional[str] = None,
    tags: Optional[str] = None,
    page: int = 1,
    size: int = 20,
) -> Tuple[int, List[PublicCommand]]:
    """分页搜索启用的公共命令（keyword 模糊匹配名称/描述/action_type，tags 逗号分隔）"""
    from sqlalchemy import or_

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
    return total, records


def get_public_command_by_id(db, command_id: int) -> Optional[PublicCommand]:
    return db.query(PublicCommand).filter(PublicCommand.id == command_id).first()


def get_public_command_by_name(db, name: str) -> Optional[PublicCommand]:
    return db.query(PublicCommand).filter(PublicCommand.name == name).first()


# =====================================================================
# CRUD
# =====================================================================
def create_public_command(
    db,
    name: str,
    action_type: str,
    shell_command: str,
    description: Optional[str] = None,
    timeout: Optional[int] = None,
    default_params: Optional[dict] = None,
    tags: Optional[str] = None,
    is_active: bool = True,
    check_duplicate: bool = False,
) -> PublicCommand:
    if check_duplicate and db.query(PublicCommand).filter(PublicCommand.name == name).first():
        raise ValueError(f"公共命令 '{name}' 已存在")

    now = datetime.now(UTC)
    command = PublicCommand(
        name=name,
        action_type=action_type,
        description=description,
        shell_command=shell_command,
        timeout=timeout or 600,
        default_params=default_params,
        tags=tags,
        is_active=is_active,
        created_at=now,
        updated_at=now,
    )
    db.add(command)
    db.commit()
    db.refresh(command)
    return command


def update_public_command(db, command: PublicCommand, **fields) -> PublicCommand:
    """仅更新传入（非 None）的字段"""
    for key, value in fields.items():
        if value is not None:
            setattr(command, key, value)
    command.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(command)
    return command


def delete_public_commands(db, ids: List[int]) -> int:
    deleted = db.query(PublicCommand).filter(PublicCommand.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return deleted


# =====================================================================
# 模板导入
# =====================================================================
def import_to_project(
    db,
    public_command_id: int,
    project_id: int,
    description: Optional[str] = None,
    timeout: Optional[int] = None,
    check_duplicate_action: bool = False,
) -> Command:
    """
    将公共命令模板复制为项目专属命令。
    - check_duplicate_action=True 时（MCP 路径），若项目已存在同 action_type 命令则报错
    - description/timeout 可覆盖模板默认值
    """
    template = db.query(PublicCommand).filter(
        PublicCommand.id == public_command_id,
        PublicCommand.is_active == True,  # noqa: E712
    ).first()
    if not template:
        raise ValueError("公共命令不存在或已禁用")

    if check_duplicate_action:
        if db.query(Command).filter(
            Command.project_id == project_id, Command.action_type == template.action_type
        ).first():
            raise ValueError(f"项目已存在 action_type='{template.action_type}' 的命令")

    command = Command(
        project_id=project_id,
        action_type=template.action_type,
        description=description if description is not None else template.description,
        shell_command=template.shell_command,
        timeout=timeout or template.timeout,
        default_params=template.default_params,
        created_at=datetime.now(UTC),
    )
    db.add(command)
    db.commit()
    db.refresh(command)
    return command
