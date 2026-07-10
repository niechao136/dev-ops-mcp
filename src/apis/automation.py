from fastapi import APIRouter, Depends, HTTPException
from typing import List, Annotated, Optional
from datetime import datetime, UTC

from sqlalchemy import asc, desc

from src.dbs.db import get_db_session
from src.dbs.orm import Automation, Project, Command, User
from src.schemas.api import DataResult, PageResult
from src.schemas.automation import AutomationAdd, AutomationUpdate, AutomationInfo
from src.utils.auth import get_current_admin, get_current_user

automation_router = APIRouter(
    prefix="/automations",
    tags=["自动化规则"]
)


@automation_router.get(
    path="/{project_id}",
    response_model=PageResult[AutomationInfo],
    summary="获取项目的自动化规则列表"
)
async def get_project_automations(
    project_id: int,
    page: int = 1,
    size: int = 20,
    _: User = Depends(get_current_user)
):
    offset = (page - 1) * size

    with get_db_session() as db:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return DataResult(status=0, msg="项目不存在")

        query = db.query(Automation).filter(Automation.project_id == project_id)
        total = query.count()
        automations = query.offset(offset).limit(size).all()

        result_items = []
        for automation in automations:
            command = db.query(Command).filter(Command.id == automation.command_id).first()
            command_action = command.action_type if command else ""
            command_description = command.description if command else ""

            result_items.append({
                "id": automation.id,
                "project_id": automation.project_id,
                "project_name": project.name,
                "name": automation.name,
                "trigger_type": automation.trigger_type,
                "cron_expression": automation.cron_expression,
                "condition_script": automation.condition_script,
                "condition_interval": automation.condition_interval,
                "command_id": automation.command_id,
                "command_action": command_action,
                "command_description": command_description,
                "is_enabled": automation.is_enabled,
                "last_run_time": automation.last_run_time.isoformat() if automation.last_run_time else None,
                "last_run_status": automation.last_run_status,
                "created_at": automation.created_at.isoformat(),
                "updated_at": automation.updated_at.isoformat()
            })

        return PageResult(
            total=total,
            data=result_items,
            page=page,
            size=size
        )


@automation_router.post(
    path="",
    response_model=DataResult[int],
    summary="创建自动化规则"
)
async def create_automation(
    data: AutomationAdd,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        project = db.query(Project).filter(Project.id == data.project_id).first()
        if not project:
            return DataResult(status=0, msg="项目不存在")

        command = db.query(Command).filter(Command.id == data.command_id).first()
        if not command:
            return DataResult(status=0, msg="命令不存在")

        trigger_type = data.trigger_type
        if trigger_type not in ["cron", "condition"]:
            return DataResult(status=0, msg="触发类型必须是 cron 或 condition")

        if trigger_type == "cron" and not data.cron_expression:
            return DataResult(status=0, msg="定时触发需要配置 cron 表达式")

        if trigger_type == "condition" and not data.condition_script:
            return DataResult(status=0, msg="条件触发需要配置检查脚本")

        new_automation = Automation(
            project_id=data.project_id,
            name=data.name,
            trigger_type=trigger_type,
            cron_expression=data.cron_expression,
            condition_script=data.condition_script,
            condition_interval=data.condition_interval or 60,
            command_id=data.command_id,
            is_enabled=data.is_enabled if data.is_enabled is not None else True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )

        db.add(new_automation)
        db.commit()
        db.refresh(new_automation)

        return DataResult(status=1, data=new_automation.id, msg="创建成功")


@automation_router.put(
    path="/{automation_id}",
    response_model=DataResult[bool],
    summary="更新自动化规则"
)
async def update_automation(
    automation_id: int,
    data: AutomationUpdate,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        automation = db.query(Automation).filter(Automation.id == automation_id).first()
        if not automation:
            return DataResult(status=0, msg="自动化规则不存在")

        if data.name is not None:
            automation.name = data.name

        if data.trigger_type is not None:
            trigger_type = data.trigger_type
            if trigger_type not in ["cron", "condition"]:
                return DataResult(status=0, msg="触发类型必须是 cron 或 condition")
            automation.trigger_type = trigger_type

        if data.cron_expression is not None:
            automation.cron_expression = data.cron_expression

        if data.condition_script is not None:
            automation.condition_script = data.condition_script

        if data.condition_interval is not None:
            automation.condition_interval = data.condition_interval

        if data.command_id is not None:
            command = db.query(Command).filter(Command.id == data.command_id).first()
            if not command:
                return DataResult(status=0, msg="命令不存在")
            automation.command_id = data.command_id

        if data.is_enabled is not None:
            automation.is_enabled = data.is_enabled

        automation.updated_at = datetime.now(UTC)
        db.commit()

        return DataResult(status=1, data=True, msg="更新成功")


@automation_router.delete(
    path="/{automation_id}",
    response_model=DataResult[bool],
    summary="删除自动化规则"
)
async def delete_automation(
    automation_id: int,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        automation = db.query(Automation).filter(Automation.id == automation_id).first()
        if not automation:
            return DataResult(status=0, msg="自动化规则不存在")

        db.delete(automation)
        db.commit()

        return DataResult(status=1, data=True, msg="删除成功")


@automation_router.put(
    path="/{automation_id}/toggle",
    response_model=DataResult[bool],
    summary="启用/禁用自动化规则"
)
async def toggle_automation(
    automation_id: int,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        automation = db.query(Automation).filter(Automation.id == automation_id).first()
        if not automation:
            return DataResult(status=0, msg="自动化规则不存在")

        automation.is_enabled = not automation.is_enabled
        automation.updated_at = datetime.now(UTC)
        db.commit()

        return DataResult(
            status=1,
            data=automation.is_enabled,
            msg="已" + ("启用" if automation.is_enabled else "禁用")
        )