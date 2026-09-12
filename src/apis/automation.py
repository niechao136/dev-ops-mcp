from fastapi import APIRouter, Depends, HTTPException
from typing import List, Annotated, Optional
from datetime import datetime, UTC

from sqlalchemy import asc, desc

from src.dbs.db import get_db_session
from src.dbs.orm import Automation, User
from src.schemas.api import DataResult, PageResult
from src.schemas.automation import AutomationAdd, AutomationUpdate, AutomationInfo
from src.services import automation_service
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
    with get_db_session() as db:
        try:
            total, items = automation_service.list_project_automations(db, project_id, page, size)
        except ValueError as e:
            return DataResult(status=0, msg=str(e))

        return PageResult(
            total=total,
            data=items,
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
        try:
            new_automation = automation_service.create_automation(
                db,
                project_id=data.project_id,
                name=data.name,
                trigger_type=data.trigger_type,
                command_id=data.command_id,
                cron_expression=data.cron_expression,
                condition_script=data.condition_script,
                condition_interval=data.condition_interval,
                is_enabled=data.is_enabled,
            )
        except ValueError as e:
            return DataResult(status=0, msg=str(e))

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
        automation = automation_service.get_automation_by_id(db, automation_id)
        if not automation:
            return DataResult(status=0, msg="自动化规则不存在")

        fields = data.model_dump(exclude_unset=True)
        try:
            automation_service.update_automation(db, automation, **fields)
        except ValueError as e:
            return DataResult(status=0, msg=str(e))

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
        automation = automation_service.get_automation_by_id(db, automation_id)
        if not automation:
            return DataResult(status=0, msg="自动化规则不存在")

        automation_service.delete_automation(db, automation)

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
        automation = automation_service.get_automation_by_id(db, automation_id)
        if not automation:
            return DataResult(status=0, msg="自动化规则不存在")

        is_enabled = automation_service.toggle_automation(db, automation)

        return DataResult(
            status=1,
            data=is_enabled,
            msg="已" + ("启用" if is_enabled else "禁用")
        )
