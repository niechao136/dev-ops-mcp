import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Annotated, Optional

from sqlalchemy import asc, desc, or_

from src.dbs.db import get_db_session
from src.dbs.orm import Project, Task, User
from src.schemas.api import DataResult, PageResult
from src.schemas.project import (
    ProjectPageParams, ProjectInfo, ProjectAdd, ProjectUpdate, ProjectDel,
    CommandInfo, CommandAdd, CommandUpdate, CommandDel, CommandExecute,
    ProjectRunningTask
)
from src.services import project_service
from src.utils.auth import get_current_admin, get_current_user


project_router = APIRouter(
    prefix="/projects",
    tags=["项目管理"]
)


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
        health_tasks = []

        for record in records:
            command_count = len(record.commands)
            result_items.append(
                {
                    "record": record,
                    "command_count": command_count
                }
            )
            health_tasks.append(project_service.check_project_health(record))

        if health_tasks:
            health_results = await asyncio.gather(*health_tasks, return_exceptions=True)
            for i, result in enumerate(health_results):
                if isinstance(result, Exception):
                    result_items[i]["health_status"] = "unknown"
                else:
                    result_items[i]["health_status"] = result

        final_items = [
            ProjectInfo(
                id=item["record"].id,
                name=item["record"].name,
                description=item["record"].description,
                work_dir=item["record"].work_dir,
                is_active=item["record"].is_active,
                command_count=item["command_count"],
                health_status=item.get("health_status", "unknown")
            )
            for item in result_items
        ]

        return PageResult(
            total=total,
            data=final_items,
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
        project = project_service.get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        command_count = len(project.commands)
        health_status = await project_service.check_project_health(project)

        running_task = db.query(Task).filter(
            Task.project_name == project.name,
            Task.status == "running"
        ).first()

        running_task_info = None
        if running_task:
            running_task_info = ProjectRunningTask(
                task_id=running_task.task_id,
                action=running_task.action,
                output_log=running_task.output_log or "",
                start_time=running_task.start_time.isoformat() if running_task.start_time else None
            )

        return DataResult(
            status=1,
            data=ProjectInfo(
                id=project.id,
                name=project.name,
                description=project.description,
                work_dir=project.work_dir,
                is_active=project.is_active,
                command_count=command_count,
                health_status=health_status,
                running_task=running_task_info
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
        try:
            new_project = project_service.create_project(
                db,
                name=project_data.name,
                description=project_data.description,
                work_dir=project_data.work_dir,
            )
        except ValueError as e:
            return DataResult(status=0, msg=str(e))

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
        project = project_service.get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        try:
            project_service.update_project(
                db,
                project,
                name=project_data.name,
                description=project_data.description,
                work_dir=project_data.work_dir,
                is_active=project_data.is_active,
            )
        except ValueError as e:
            return DataResult(status=0, msg=str(e))

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
        deleted_count = project_service.delete_projects(db, delete_data.ids)

        return DataResult(status=1, data=True, msg=f"删除了 {deleted_count} 个项目")


@project_router.get(
    path="/{project_id}/commands",
    response_model=PageResult[CommandInfo],
    summary="获取项目命令列表"
)
async def project_commands(
    project_id: int,
    page: int = 1,
    size: int = 20,
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        project = project_service.get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        total, commands = project_service.list_project_commands(db, project_id, page, size)

        result_items = [
            CommandInfo(
                id=cmd.id,
                project_id=cmd.project_id,
                action_type=cmd.action_type,
                description=cmd.description,
                shell_command=cmd.shell_command,
                timeout=cmd.timeout,
                default_params=cmd.default_params,
                work_dir=cmd.work_dir,
                is_health_check=cmd.is_health_check,
                requires_confirm=cmd.requires_confirm
            )
            for cmd in commands
        ]

        return PageResult(
            total=total,
            data=result_items,
            page=page,
            size=size
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
        project = project_service.get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        new_command = project_service.create_command(
            db,
            project_id=project_id,
            action_type=command_data.action_type,
            description=command_data.description,
            shell_command=command_data.shell_command,
            timeout=command_data.timeout,
            default_params=command_data.default_params,
            work_dir=command_data.work_dir,
            requires_confirm=command_data.requires_confirm,
        )

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
        command = project_service.get_command_by_id(db, command_id)
        if not command:
            return DataResult(status=0, msg="命令不存在")

        project_service.update_command(
            db,
            command,
            action_type=command_data.action_type,
            description=command_data.description,
            shell_command=command_data.shell_command,
            timeout=command_data.timeout,
            default_params=command_data.default_params,
            work_dir=command_data.work_dir,
            requires_confirm=command_data.requires_confirm,
        )

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
        deleted_count = project_service.delete_commands(db, delete_data.ids)

        return DataResult(status=1, data=True, msg=f"删除了 {deleted_count} 个命令")


@project_router.put(
    path="/commands/{command_id}/health_check",
    response_model=DataResult[bool],
    summary="设置/取消健康检查命令"
)
async def set_health_check_command(
    command_id: int,
    _: User = Depends(get_current_admin)
):
    with get_db_session() as db:
        command = project_service.get_command_by_id(db, command_id)
        if not command:
            return DataResult(status=0, msg="命令不存在")

        is_set = project_service.set_health_check(db, command)

        return DataResult(
            status=1,
            data=is_set,
            msg="已设置为健康检查命令" if is_set else "已取消健康检查命令"
        )


@project_router.get(
    path="/{project_id}/health_check",
    response_model=DataResult[dict],
    summary="执行健康检查"
)
async def execute_health_check(
    project_id: int,
    _: User = Depends(get_current_user)
):
    with get_db_session() as db:
        project = project_service.get_project_by_id(db, project_id)
        if not project:
            return DataResult(status=0, msg="项目不存在")

        try:
            result = await project_service.run_health_check_detail(project)
        except ValueError as e:
            return DataResult(status=1, data={"status": "unknown", "message": str(e)}, msg=str(e))

        overall_status = result["status"]
        return DataResult(
            status=1,
            data={
                "status": overall_status,
                "project_name": project.name,
                "results": result["results"]
            },
            msg=f"健康检查{'通过' if overall_status == 'healthy' else '失败'}"
        )


@project_router.post(
    path="/execute",
    response_model=DataResult[dict],
    summary="执行命令（异步）"
)
async def command_execute(
    execute_data: CommandExecute,
    _: User = Depends(get_current_admin)
):
    from src.utils.task_executor import is_project_locked, get_running_task
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
        try:
            task_id = project_service.submit_execute(
                db,
                project_name=project_name,
                action=action,
                params=params,
                actor_type="human",
                actor_id=caller_token_id,
            )
        except ValueError as e:
            return DataResult(status=0, msg=str(e))

    return DataResult(
        status=1,
        data={
            "task_id": task_id,
            "status": "pending",
            "message": "任务已提交，正在排队中"
        },
        msg="任务提交成功"
    )
