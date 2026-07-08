import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Optional

from src.dbs.db import get_db_session
from src.dbs.orm import Task, User, Project, Command
from src.schemas.api import DataResult, PageResult
from src.schemas.task import TaskInfo, TaskSubmitResult
from src.schemas.project import CommandExecute
from src.utils.auth import get_current_user
from src.utils.task_executor import submit_task, get_task_info, cancel_task, is_project_locked, get_running_task
from src.utils.context import current_mcp_token


task_router = APIRouter(
    prefix="/tasks",
    tags=["任务管理"]
)


@task_router.get(
    path="/{task_id}",
    response_model=DataResult[TaskInfo],
    summary="查询任务状态"
)
async def task_status(
    task_id: str,
    log_offset: int = 0,
    _: User = Depends(get_current_user)
):
    task_info = get_task_info(task_id)
    if not task_info:
        return DataResult(status=0, msg="任务不存在")
    
    full_log = task_info.get("output_log", "")
    if log_offset > 0:
        task_info["output_log"] = full_log[log_offset:]
    task_info["next_offset"] = len(full_log)
    
    return DataResult(status=1, data=task_info)


@task_router.get(
    path="",
    response_model=PageResult[TaskInfo],
    summary="获取任务列表"
)
async def task_list(
    project_name: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    _: User = Depends(get_current_user)
):
    offset = (page - 1) * size
    
    with get_db_session() as db:
        query = db.query(Task)
        
        if project_name:
            query = query.filter(Task.project_name == project_name)
        
        if status:
            query = query.filter(Task.status == status)
        
        total = query.count()
        records = query.order_by(Task.created_at.desc()).offset(offset).limit(size).all()
    
    result_items = []
    for record in records:
        output_log = record.output_log or ""
        result_items.append(TaskInfo(
            task_id=record.task_id,
            project_name=record.project_name,
            action=record.action,
            status=record.status,
            output_log=output_log,
            next_offset=len(output_log),
            start_time=record.start_time.isoformat() if record.start_time else None,
            end_time=record.end_time.isoformat() if record.end_time else None,
            timeout=record.timeout,
            created_at=record.created_at.isoformat()
        ))
    
    return PageResult(
        total=total,
        data=result_items,
        page=page,
        size=size
    )


@task_router.post(
    path="/{task_id}/cancel",
    response_model=DataResult[bool],
    summary="取消任务"
)
async def task_cancel(
    task_id: str,
    _: User = Depends(get_current_user)
):
    success = await cancel_task(task_id)
    if success:
        return DataResult(status=1, data=True, msg="取消成功")
    return DataResult(status=0, msg="取消失败，任务可能已完成或不存在")


@task_router.get(
    path="/{task_id}/stream",
    summary="SSE 实时日志流"
)
async def task_stream(
    task_id: str,
    token: Optional[str] = None,
    _: User = Depends(get_current_user)
):
    async def generate():
        last_log_length = 0
        
        while True:
            task_info = get_task_info(task_id)
            if not task_info:
                yield f"data: {{'error': '任务不存在'}}\n\n"
                return
            
            current_log = task_info.get("output_log", "")
            if len(current_log) > last_log_length:
                new_content = current_log[last_log_length:]
                last_log_length = len(current_log)
                yield f"data: {new_content}\n\n"
            
            if task_info["status"] in ("success", "failed", "timeout", "cancelled"):
                yield f"data: {{'status': '{task_info['status']}', 'end': true}}\n\n"
                return
            
            await asyncio.sleep(1)
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Transfer-Encoding": "chunked"
        }
    )


@task_router.post(
    path="/execute",
    response_model=DataResult[TaskSubmitResult],
    summary="提交执行任务（异步）"
)
async def task_execute(
    execute_data: CommandExecute,
    _: User = Depends(get_current_user)
):
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
            data={"task_id": running_task_id, "status": "running", "message": "项目执行中"}
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
            return DataResult(status=0, msg=f"项目 '{project_name}' 未配置 '{action}' 操作")
        
        raw_command_text = command.shell_command
        merged_params = {**(command.default_params or {}), **(params or {})}
        
        if merged_params:
            for key, value in merged_params.items():
                placeholder = f"${{{key}}}"
                raw_command_text = raw_command_text.replace(placeholder, str(value))
        
        command_list = [line.strip() for line in raw_command_text.splitlines() if line.strip()]
        
        if not command_list:
            return DataResult(status=0, msg=f"'{action}' 配置的脚本内容为空")
        
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
        data=TaskSubmitResult(
            task_id=task_id,
            status="pending",
            message="任务已提交，正在排队中"
        ),
        msg="任务提交成功"
    )