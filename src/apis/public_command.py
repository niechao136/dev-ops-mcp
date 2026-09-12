from fastapi import APIRouter, Depends, HTTPException
from typing import List, Annotated, Optional
from datetime import datetime, UTC

from sqlalchemy import asc, desc, or_

from src.dbs.db import get_db_session
from src.dbs.orm import PublicCommand, User
from src.schemas.api import DataResult, PageResult
from src.schemas.public_command import (
    PublicCommandPageParams, PublicCommandInfo, PublicCommandAdd,
    PublicCommandUpdate, PublicCommandDel, PublicCommandImport, PublicCommandBatchImport
)
from src.services import public_command_service
from src.utils.auth import get_current_admin, get_current_user


public_command_router = APIRouter(
    prefix="/public_commands",
    tags=["公共命令"]
)


def _to_info(r: PublicCommand) -> PublicCommandInfo:
    return PublicCommandInfo(
        id=r.id,
        name=r.name,
        action_type=r.action_type,
        description=r.description,
        shell_command=r.shell_command,
        timeout=r.timeout,
        default_params=r.default_params,
        tags=r.tags,
        is_active=r.is_active,
        created_at=r.created_at,
        updated_at=r.updated_at
    )


@public_command_router.get(
    path="",
    response_model=PageResult[PublicCommandInfo],
    summary="获取公共命令列表",
    description="分页获取公共命令列表，支持搜索和标签筛选"
)
async def get_public_commands(
    params: Annotated[PublicCommandPageParams, Depends()],
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        total, records = public_command_service.list_public_commands(
            db,
            keyword=params.keyword,
            tags=params.tags,
            page=params.page,
            size=params.size,
        )

        result_items = [_to_info(r) for r in records]

        return PageResult(
            total=total,
            data=result_items,
            page=params.page,
            size=params.size
        )


@public_command_router.get(
    path="/{command_id}",
    response_model=DataResult[PublicCommandInfo],
    summary="获取公共命令详情",
    description="根据 ID 获取单个公共命令的详细信息"
)
async def get_public_command(
    command_id: int,
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        command = public_command_service.get_public_command_by_id(db, command_id)

        if not command:
            return DataResult(status=0, msg="公共命令不存在")

        return DataResult(status=1, data=_to_info(command))


@public_command_router.post(
    path="",
    response_model=DataResult[int],
    summary="创建公共命令",
    description="创建新的公共命令模板"
)
async def create_public_command(
    data: PublicCommandAdd,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        command = public_command_service.create_public_command(
            db,
            name=data.name,
            action_type=data.action_type,
            shell_command=data.shell_command,
            description=data.description,
            timeout=data.timeout,
            default_params=data.default_params,
            tags=data.tags,
        )

        return DataResult(status=1, data=command.id, msg="创建成功")


@public_command_router.put(
    path="/{command_id}",
    response_model=DataResult[PublicCommandInfo],
    summary="更新公共命令",
    description="更新公共命令的详细信息"
)
async def update_public_command(
    command_id: int,
    data: PublicCommandUpdate,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        command = public_command_service.get_public_command_by_id(db, command_id)

        if not command:
            return DataResult(status=0, msg="公共命令不存在")

        update_data = data.model_dump(exclude_unset=True)
        command = public_command_service.update_public_command(db, command, **update_data)

        return DataResult(status=1, data=_to_info(command), msg="更新成功")


@public_command_router.delete(
    path="",
    response_model=DataResult,
    summary="删除公共命令",
    description="批量删除公共命令"
)
async def delete_public_commands(
    data: PublicCommandDel,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        count = public_command_service.delete_public_commands(db, data.ids)

        return DataResult(status=1, msg=f"成功删除 {count} 条记录")


@public_command_router.post(
    path="/import",
    response_model=DataResult[int],
    summary="导入公共命令到项目",
    description="将公共命令复制到指定项目，成为项目专属命令"
)
async def import_public_command(
    data: PublicCommandImport,
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        try:
            project_cmd = public_command_service.import_to_project(
                db,
                public_command_id=data.public_command_id,
                project_id=data.project_id,
            )
        except ValueError as e:
            return DataResult(status=0, msg=str(e))

        return DataResult(
            status=1,
            data=project_cmd.id,
            msg=f"成功导入到项目，命令 ID: {project_cmd.id}"
        )


@public_command_router.post(
    path="/batch_import",
    response_model=DataResult[List[int]],
    summary="批量导入公共命令到项目",
    description="将多个公共命令批量复制到指定项目"
)
async def batch_import_public_command(
    data: PublicCommandBatchImport,
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        imported_ids = []
        for cmd_id in data.public_command_ids:
            try:
                project_cmd = public_command_service.import_to_project(
                    db,
                    public_command_id=cmd_id,
                    project_id=data.project_id,
                )
                imported_ids.append(project_cmd.id)
            except ValueError:
                continue

        if not imported_ids:
            return DataResult(status=0, msg="未找到有效的公共命令")

        return DataResult(
            status=1,
            data=imported_ids,
            msg=f"成功导入 {len(imported_ids)} 条命令"
        )
