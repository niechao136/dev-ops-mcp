from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Annotated, Optional

from sqlalchemy import asc, desc, or_

from src.dbs.db import get_db_session
from src.dbs.orm import Project, Command, User
from src.schemas.api import DataResult, PageResult
from src.schemas.project import (
    ProjectPageParams, ProjectInfo, ProjectAdd, ProjectUpdate, ProjectDel,
    CommandInfo, CommandAdd, CommandUpdate, CommandDel, CommandExecute
)
from src.utils.auth import get_current_admin, get_current_user


project_router = APIRouter(
    prefix="/projects",
    tags=["项目管理"]
)


def get_project_by_id(db, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id).first()


@project_router.get(
    path="",
    response_model=PageResult[ProjectInfo],
    summary="获取项目列表",
    description="分页获取项目列表，支持搜索和排序"
)
async def project_list(
    params: Annotated[ProjectPageParams, Depends()],
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        query = db.query(Project)

        if params.keyword:
            search = f"%{params.keyword}%"
            query = query.filter(
                or_(
                    Project.name.ilike(search),
                    Project.description.ilike(search)
                )
            )

        total = query.count()

        if params.order_by:
            order_column = getattr(Project, params.order_by)
            if params.direction == "asc":
                query = query.order_by(asc(order_column))
            else:
                query = query.order_by(desc(order_column))

        records = query.offset(params.offset).limit(params.size).all()

        result_items = []
        for record in records:
            command_count = len(record.commands)
            result_items.append(
                ProjectInfo(
                    id=record.id,
                    name=record.name,
                    description=record.description,
                    work_dir=record.work_dir,
                    is_active=record.is_active,
                    command_count=command_count
                )
            )

        return PageResult(
            total=total,
            data=result_items,
            page=params.page,
            size=params.size
        )


@project_router.get(
    path="/count",
    response_model=DataResult[int],
    summary="获取项目总数"
)
async def project_count(_: User = Depends(get_current_user)):
    with get_db_session() as db:
        count = db.query(Project).count()

    return DataResult(status=1, data=count)


@project_router.get(
    path="/{project_id}",
    response_model=DataResult[ProjectInfo],
    summary="获取项目详情"
)
async def project_detail(
    project_id: int,
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        project = get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        command_count = len(project.commands)

        return DataResult(
            status=1,
            data=ProjectInfo(
                id=project.id,
                name=project.name,
                description=project.description,
                work_dir=project.work_dir,
                is_active=project.is_active,
                command_count=command_count
            )
        )


@project_router.post(
    path="",
    response_model=DataResult[int],
    summary="创建项目"
)
async def project_create(
    project_data: ProjectAdd,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        exists = db.query(Project).filter(Project.name == project_data.name).first()
        if exists:
            return DataResult(status=0, msg="项目名称已存在")

        new_project = Project(
            name=project_data.name,
            description=project_data.description,
            work_dir=project_data.work_dir,
            is_active=True
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)

        return DataResult(status=1, data=new_project.id, msg="创建成功")


@project_router.put(
    path="/{project_id}",
    response_model=DataResult[bool],
    summary="更新项目"
)
async def project_update(
    project_id: int,
    project_data: ProjectUpdate,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        project = get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        if project_data.name and project_data.name != project.name:
            exists = db.query(Project).filter(Project.name == project_data.name).first()
            if exists:
                return DataResult(status=0, msg="项目名称已存在")
            project.name = project_data.name

        if project_data.description is not None:
            project.description = project_data.description

        if project_data.work_dir:
            project.work_dir = project_data.work_dir

        if project_data.is_active is not None:
            project.is_active = project_data.is_active

        db.commit()

        return DataResult(status=1, data=True, msg="更新成功")


@project_router.delete(
    path="",
    response_model=DataResult[bool],
    summary="删除项目"
)
async def project_delete(
    delete_data: ProjectDel,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        deleted_count = db.query(Project).filter(
            Project.id.in_(delete_data.ids)
        ).delete(synchronize_session=False)
        db.commit()

        return DataResult(status=1, data=True, msg=f"删除了 {deleted_count} 个项目")


@project_router.get(
    path="/{project_id}/commands",
    response_model=PageResult[CommandInfo],
    summary="获取项目命令列表"
)
async def project_commands(
    project_id: int,
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        project = get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        commands = db.query(Command).filter(Command.project_id == project_id).all()

        result_items = [
            CommandInfo(
                id=cmd.id,
                project_id=cmd.project_id,
                action_type=cmd.action_type,
                description=cmd.description,
                shell_command=cmd.shell_command,
                timeout=cmd.timeout,
                default_params=cmd.default_params
            )
            for cmd in commands
        ]

        return PageResult(
            total=len(result_items),
            data=result_items,
            page=1,
            size=len(result_items)
        )


@project_router.post(
    path="/{project_id}/commands",
    response_model=DataResult[int],
    summary="添加命令"
)
async def command_create(
    project_id: int,
    command_data: CommandAdd,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        project = get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        new_command = Command(
            project_id=project_id,
            action_type=command_data.action_type,
            description=command_data.description,
            shell_command=command_data.shell_command,
            timeout=command_data.timeout,
            default_params=command_data.default_params
        )
        db.add(new_command)
        db.commit()
        db.refresh(new_command)

        return DataResult(status=1, data=new_command.id, msg="创建成功")


@project_router.put(
    path="/commands/{command_id}",
    response_model=DataResult[bool],
    summary="更新命令"
)
async def command_update(
    command_id: int,
    command_data: CommandUpdate,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        command = db.query(Command).filter(Command.id == command_id).first()
        if not command:
            return DataResult(status=0, msg="命令不存在")

        if command_data.action_type:
            command.action_type = command_data.action_type

        if command_data.description is not None:
            command.description = command_data.description

        if command_data.shell_command:
            command.shell_command = command_data.shell_command

        if command_data.timeout:
            command.timeout = command_data.timeout

        if command_data.default_params is not None:
            command.default_params = command_data.default_params

        db.commit()

        return DataResult(status=1, data=True, msg="更新成功")


@project_router.delete(
    path="/commands",
    response_model=DataResult[bool],
    summary="删除命令"
)
async def command_delete(
    delete_data: CommandDel,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        deleted_count = db.query(Command).filter(
            Command.id.in_(delete_data.ids)
        ).delete(synchronize_session=False)
        db.commit()

        return DataResult(status=1, data=True, msg=f"删除了 {deleted_count} 个命令")


@project_router.post(
    path="/execute",
    response_model=DataResult[dict],
    summary="执行命令（异步）"
)
async def command_execute(
    execute_data: CommandExecute,
    _: User = Depends(get_current_admin)
):
    from src.utils.task_executor import submit_task, is_project_locked, get_running_task
    from src.utils.context import current_mcp_token
    
    caller_token = current_mcp_token.get()
    caller_token_id = caller_token.id if caller_token else 0
    
    project_name = execute_data.project_name
    action = execute_data.action
    params = execute_data.params
    
    if is_project_locked(project_name):
        running_task_id = get_running_task(project_name)
        return DataResult(
            status=0,
            msg=f"项目 '{project_name}' 当前有任务正在执行，请稍后再试",
            data={"task_id": running_task_id, "status": "running"}
        )
    
    with get_db_session() as db:
        project = db.query(Project).filter(
            Project.name == project_name,
            Project.is_active == True
        ).first()
        
        if not project:
            return DataResult(status=0, msg=f"找不到激活的项目: {project_name}")

        command = db.query(Command).filter(
            Command.project_id == project.id,
            Command.action_type == action
        ).first()
        
        if not command:
            return DataResult(status=0, msg=f"项目 '{project_name}' 未配置 '{action}' 操作。")

        raw_command_text = command.shell_command
        
        merged_params = {**(command.default_params or {}), **(params or {})}
        
        if merged_params:
            for key, value in merged_params.items():
                placeholder = f"${{{key}}}"
                raw_command_text = raw_command_text.replace(placeholder, str(value))

        command_list = [line.strip() for line in raw_command_text.splitlines() if line.strip()]

        if not command_list:
            return DataResult(status=0, msg=f"'{action}' 配置的脚本内容为空。")

        command_details = {
            "script": command.shell_command,
            "params": params,
            "default_params": command.default_params
        }

        task_id = submit_task(
            project_name=project_name,
            action=action,
            commands=command_list,
            work_dir=project.work_dir,
            timeout=command.timeout,
            actor_type="human",
            actor_id=caller_token_id,
            command_details=command_details
        )

    return DataResult(
        status=1,
        data={
            "task_id": task_id,
            "status": "pending",
            "message": "任务已提交，正在排队中"
        },
        msg="任务提交成功"
    )
