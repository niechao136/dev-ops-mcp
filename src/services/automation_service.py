"""
自动化规则领域服务：供 REST API（apis/automation.py）与 MCP 工具（tools/）共用。

约定: 业务校验失败抛出 ValueError，由调用方转换为各自响应格式。
"""

from datetime import datetime, UTC
from typing import List, Optional, Tuple

from src.dbs.orm import Automation, Command, Project


VALID_TRIGGER_TYPES = ("cron", "condition")


def _validate_trigger(trigger_type: str, cron_expression: Optional[str], condition_script: Optional[str]):
    if trigger_type not in VALID_TRIGGER_TYPES:
        raise ValueError("触发类型必须是 cron 或 condition")
    if trigger_type == "cron" and not cron_expression:
        raise ValueError("定时触发需要配置 cron 表达式")
    if trigger_type == "condition" and not condition_script:
        raise ValueError("条件触发需要配置检查脚本")


# =====================================================================
# 查询
# =====================================================================
def list_project_automations(db, project_id: int, page: int = 1, size: int = 20) -> Tuple[int, List[dict]]:
    """分页获取项目自动化规则（附带命令 action 信息），返回 (total, items)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ValueError("项目不存在")

    query = db.query(Automation).filter(Automation.project_id == project_id)
    total = query.count()
    automations = query.offset((page - 1) * size).limit(size).all()

    items = []
    for automation in automations:
        command = db.query(Command).filter(Command.id == automation.command_id).first()
        items.append({
            "id": automation.id,
            "project_id": automation.project_id,
            "project_name": project.name,
            "name": automation.name,
            "trigger_type": automation.trigger_type,
            "cron_expression": automation.cron_expression,
            "condition_script": automation.condition_script,
            "condition_interval": automation.condition_interval,
            "command_id": automation.command_id,
            "command_action": command.action_type if command else "",
            "command_description": command.description if command else "",
            "is_enabled": automation.is_enabled,
            "last_run_time": automation.last_run_time.isoformat() if automation.last_run_time else None,
            "last_run_status": automation.last_run_status,
            "created_at": automation.created_at.isoformat(),
            "updated_at": automation.updated_at.isoformat(),
        })
    return total, items


def get_automation_by_id(db, automation_id: int) -> Optional[Automation]:
    return db.query(Automation).filter(Automation.id == automation_id).first()


# =====================================================================
# CRUD
# =====================================================================
def create_automation(
    db,
    project_id: int,
    name: str,
    trigger_type: str,
    command_id: int,
    cron_expression: Optional[str] = None,
    condition_script: Optional[str] = None,
    condition_interval: Optional[int] = None,
    is_enabled: Optional[bool] = None,
) -> Automation:
    if not db.query(Project).filter(Project.id == project_id).first():
        raise ValueError("项目不存在")

    command = db.query(Command).filter(Command.id == command_id).first()
    if not command:
        raise ValueError("命令不存在")

    _validate_trigger(trigger_type, cron_expression, condition_script)

    automation = Automation(
        project_id=project_id,
        name=name,
        trigger_type=trigger_type,
        cron_expression=cron_expression,
        condition_script=condition_script,
        condition_interval=condition_interval or 60,
        command_id=command_id,
        is_enabled=is_enabled if is_enabled is not None else True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(automation)
    db.commit()
    db.refresh(automation)
    return automation


def update_automation(db, automation: Automation, **fields) -> Automation:
    """
    更新自动化规则，仅应用传入（非 None）的字段。
    fields 支持: name / trigger_type / cron_expression / condition_script /
                 condition_interval / command_id / is_enabled
    """
    if "trigger_type" in fields and fields["trigger_type"] is not None:
        # 与原 API 行为保持一致：更新时仅校验触发类型取值合法性
        if fields["trigger_type"] not in VALID_TRIGGER_TYPES:
            raise ValueError("触发类型必须是 cron 或 condition")

    if "command_id" in fields and fields["command_id"] is not None:
        if not db.query(Command).filter(Command.id == fields["command_id"]).first():
            raise ValueError("命令不存在")

    for key, value in fields.items():
        if value is not None:
            setattr(automation, key, value)

    automation.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(automation)
    return automation


def delete_automation(db, automation: Automation) -> None:
    db.delete(automation)
    db.commit()


def toggle_automation(db, automation: Automation) -> bool:
    """切换启用/禁用状态，返回切换后的状态"""
    automation.is_enabled = not automation.is_enabled
    automation.updated_at = datetime.now(UTC)
    db.commit()
    return automation.is_enabled
