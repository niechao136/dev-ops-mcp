from fastapi import APIRouter, Depends, HTTPException
from typing import List, Annotated, Optional
from datetime import datetime, UTC

from sqlalchemy import asc, desc, or_

from src.dbs.db import get_db_session
from src.dbs.orm import PublicCommand, Command, User
from src.schemas.api import DataResult, PageResult
from src.schemas.public_command import (
    PublicCommandPageParams, PublicCommandInfo, PublicCommandAdd,
    PublicCommandUpdate, PublicCommandDel, PublicCommandImport, PublicCommandBatchImport
)
from src.utils.auth import get_current_admin, get_current_user


public_command_router = APIRouter(
    prefix="/public_commands",
    tags=["公共命令"]
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
        query = db.query(PublicCommand)

        # 筛选启用的命令
        query = query.filter(PublicCommand.is_active == True)

        # 关键词搜索
        if params.keyword:
            search = f"%{params.keyword}%"
            query = query.filter(
                or_(
                    PublicCommand.name.ilike(search),
                    PublicCommand.description.ilike(search),
                    PublicCommand.action_type.ilike(search)
                )
            )

        # 标签筛选
        if params.tags:
            tag_list = [t.strip() for t in params.tags.split(',') if t.strip()]
            for tag in tag_list:
                query = query.filter(PublicCommand.tags.ilike(f"%{tag}%"))

        total = query.count()

        # 排序
        if params.order_by:
            order_column = getattr(PublicCommand, params.order_by)
            if params.direction == "asc":
                query = query.order_by(asc(order_column))
            else:
                query = query.order_by(desc(order_column))
        else:
            query = query.order_by(desc(PublicCommand.updated_at))

        records = query.offset(params.offset).limit(params.size).all()

        result_items = [
            PublicCommandInfo(
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
            for r in records
        ]

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
        command = db.query(PublicCommand).filter(PublicCommand.id == command_id).first()

        if not command:
            return DataResult(status=0, msg="公共命令不存在")

        return DataResult(
            status=1,
            data=PublicCommandInfo(
                id=command.id,
                name=command.name,
                action_type=command.action_type,
                description=command.description,
                shell_command=command.shell_command,
                timeout=command.timeout,
                default_params=command.default_params,
                tags=command.tags,
                is_active=command.is_active,
                created_at=command.created_at,
                updated_at=command.updated_at
            )
        )


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
        now = datetime.now(UTC)
        command = PublicCommand(
            name=data.name,
            action_type=data.action_type,
            description=data.description,
            shell_command=data.shell_command,
            timeout=data.timeout,
            default_params=data.default_params,
            tags=data.tags,
            is_active=True,
            created_at=now,
            updated_at=now
        )
        db.add(command)
        db.commit()
        db.refresh(command)

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
        command = db.query(PublicCommand).filter(PublicCommand.id == command_id).first()

        if not command:
            return DataResult(status=0, msg="公共命令不存在")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(command, key, value)

        command.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(command)

        return DataResult(
            status=1,
            data=PublicCommandInfo(
                id=command.id,
                name=command.name,
                action_type=command.action_type,
                description=command.description,
                shell_command=command.shell_command,
                timeout=command.timeout,
                default_params=command.default_params,
                tags=command.tags,
                is_active=command.is_active,
                created_at=command.created_at,
                updated_at=command.updated_at
            ),
            msg="更新成功"
        )


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
        count = db.query(PublicCommand).filter(PublicCommand.id.in_(data.ids)).delete(
            synchronize_session=False
        )
        db.commit()

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
        public_cmd = db.query(PublicCommand).filter(
            PublicCommand.id == data.public_command_id,
            PublicCommand.is_active == True
        ).first()

        if not public_cmd:
            return DataResult(status=0, msg="公共命令不存在或已禁用")

        now = datetime.now(UTC)
        project_cmd = Command(
            project_id=data.project_id,
            action_type=public_cmd.action_type,
            description=public_cmd.description,
            shell_command=public_cmd.shell_command,
            timeout=public_cmd.timeout,
            default_params=public_cmd.default_params,
            created_at=now
        )
        db.add(project_cmd)
        db.commit()
        db.refresh(project_cmd)

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
        public_cmds = db.query(PublicCommand).filter(
            PublicCommand.id.in_(data.public_command_ids),
            PublicCommand.is_active == True
        ).all()

        if not public_cmds:
            return DataResult(status=0, msg="未找到有效的公共命令")

        now = datetime.now(UTC)
        project_cmds = []

        for public_cmd in public_cmds:
            project_cmd = Command(
                project_id=data.project_id,
                action_type=public_cmd.action_type,
                description=public_cmd.description,
                shell_command=public_cmd.shell_command,
                timeout=public_cmd.timeout,
                default_params=public_cmd.default_params,
                created_at=now
            )
            db.add(project_cmd)
            project_cmds.append(project_cmd)

        db.flush()
        imported_ids = [cmd.id for cmd in project_cmds]
        db.commit()

        return DataResult(
            status=1,
            data=imported_ids,
            msg=f"成功导入 {len(imported_ids)} 条命令"
        )
