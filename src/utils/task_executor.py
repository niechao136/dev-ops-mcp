import asyncio
import os
import signal
import uuid
from datetime import datetime, UTC
from typing import Optional, Dict, List, Any
from contextlib import asynccontextmanager

from src.dbs.db import get_db_session
from src.dbs.orm import Task, AuditLog
from src.utils.executor import _build_ssh_command


_running_tasks: Dict[str, asyncio.Task] = {}
_project_locks: Dict[str, asyncio.Lock] = {}
_task_results: Dict[str, dict] = {}


def get_project_lock(project_name: str) -> asyncio.Lock:
    if project_name not in _project_locks:
        _project_locks[project_name] = asyncio.Lock()
    return _project_locks[project_name]


def create_task_id() -> str:
    return str(uuid.uuid4())


async def update_task_status(task_id: str, status: str, output_log: Optional[str] = None):
    with get_db_session() as db:
        task = db.query(Task).filter(Task.task_id == task_id).first()
        if task:
            task.status = status
            if output_log is not None:
                task.output_log = output_log
            if status == "running" and not task.start_time:
                task.start_time = datetime.now(UTC)
            if status in ("success", "failed", "timeout", "cancelled") and not task.end_time:
                task.end_time = datetime.now(UTC)
            db.commit()


async def _execute_command_streaming(
        task_id: str,
        commands: List[str],
        work_dir: str,
        timeout: int
) -> tuple[bool, str, str]:
    """
    异步执行命令，支持流式输出日志
    """
    full_log = []
    start_time = datetime.now(UTC)
    
    for index, cmd in enumerate(commands, start=1):
        ssh_cmd = _build_ssh_command(cmd, work_dir)
        step_log = f"=== 步骤 {index}: [{ssh_cmd}] ==="
        full_log.append(step_log)
        await update_task_status(task_id, "running", "\n\n".join(full_log))
        
        try:
            process = await asyncio.create_subprocess_shell(
                ssh_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                preexec_fn=os.setsid if os.name != 'nt' else None
            )
            
            current_step_log = []
            
            async def read_stream(stream, is_stderr=False):
                nonlocal current_step_log
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded_line = line.decode('utf-8', errors='replace')
                    prefix = "[STDERR]" if is_stderr else "[STDOUT]"
                    current_step_log.append(f"{prefix} {decoded_line}")
                    full_log.append(f"{prefix} {decoded_line}")
                    await update_task_status(task_id, "running", "\n".join(full_log))
            
            try:
                elapsed = (datetime.now(UTC) - start_time).total_seconds()
                remaining_timeout = max(0, timeout - elapsed)
                
                if remaining_timeout <= 0:
                    full_log.append(f"❌ 整体任务总时间超时，触发熔断，未执行步骤 {index}。")
                    await update_task_status(task_id, "running", "\n".join(full_log))
                    return False, "timeout", "\n".join(full_log)
                
                stdout_task = asyncio.create_task(read_stream(process.stdout))
                stderr_task = asyncio.create_task(read_stream(process.stderr, True))
                
                done, pending = await asyncio.wait(
                    [stdout_task, stderr_task],
                    timeout=remaining_timeout,
                    return_when=asyncio.ALL_COMPLETED
                )
                
                for task in pending:
                    task.cancel()
                
                return_code = await process.wait()
                
                if return_code != 0:
                    full_log.append(f"❌ 步骤 {index} 执行失败 (Exit Code: {return_code})，后续流程已自动熔断拦截。")
                    await update_task_status(task_id, "running", "\n".join(full_log))
                    return False, "failed", "\n".join(full_log)
            
            except asyncio.TimeoutError:
                if os.name != 'nt':
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                else:
                    process.kill()
                
                full_log.append(f"❌ 步骤 {index} 运行超时被强杀。后续流程已自动终止。")
                await update_task_status(task_id, "running", "\n".join(full_log))
                return False, "timeout", "\n".join(full_log)
        
        except Exception as e:
            full_log.append(f"❌ 系统内部异常: {str(e)}")
            await update_task_status(task_id, "running", "\n".join(full_log))
            return False, "failed", "\n".join(full_log)
    
    return True, "success", "\n".join(full_log)


async def run_task_async(
        task_id: str,
        project_name: str,
        action: str,
        commands: List[str],
        work_dir: str,
        timeout: int,
        actor_type: str,
        actor_id: int,
        command_details: Dict[str, Any]
):
    """
    后台异步执行任务
    """
    lock = get_project_lock(project_name)
    
    async with lock:
        try:
            await update_task_status(task_id, "running")
            
            is_success, status, output_log = await _execute_command_streaming(
                task_id=task_id,
                commands=commands,
                work_dir=work_dir,
                timeout=timeout
            )
            
            await update_task_status(task_id, status, output_log)
            
            with get_db_session() as db:
                audit = AuditLog(
                    actor_type=actor_type,
                    actor_id=actor_id,
                    action_category="execute_cmd",
                    target_project=project_name,
                    action_details={**command_details, "action": action},
                    status=status,
                    output_log=output_log
                )
                db.add(audit)
                db.commit()
            
            _task_results[task_id] = {
                "status": status,
                "output_log": output_log,
                "is_success": is_success
            }
            
        except asyncio.CancelledError:
            await update_task_status(task_id, "cancelled")
            _task_results[task_id] = {
                "status": "cancelled",
                "output_log": "任务已被取消",
                "is_success": False
            }
        except Exception as e:
            await update_task_status(task_id, "failed", str(e))
            _task_results[task_id] = {
                "status": "failed",
                "output_log": str(e),
                "is_success": False
            }
        finally:
            if task_id in _running_tasks:
                del _running_tasks[task_id]


def submit_task(
        project_name: str,
        action: str,
        commands: List[str],
        work_dir: str,
        timeout: int,
        actor_type: str,
        actor_id: int,
        command_details: Dict[str, Any]
) -> str:
    """
    提交异步任务，立即返回 task_id
    """
    task_id = create_task_id()
    
    with get_db_session() as db:
        task = Task(
            task_id=task_id,
            project_name=project_name,
            action=action,
            status="pending",
            timeout=timeout,
            actor_type=actor_type,
            actor_id=actor_id,
            command_details=command_details,
            created_at=datetime.now(UTC)
        )
        db.add(task)
        db.commit()
    
    async_task = asyncio.create_task(
        run_task_async(
            task_id=task_id,
            project_name=project_name,
            action=action,
            commands=commands,
            work_dir=work_dir,
            timeout=timeout,
            actor_type=actor_type,
            actor_id=actor_id,
            command_details=command_details
        )
    )
    
    _running_tasks[task_id] = async_task
    
    return task_id


def get_task_info(task_id: str) -> Optional[dict]:
    """
    查询任务状态
    """
    with get_db_session() as db:
        task = db.query(Task).filter(Task.task_id == task_id).first()
        if not task:
            return None
        
        return {
            "task_id": task.task_id,
            "project_name": task.project_name,
            "action": task.action,
            "status": task.status,
            "output_log": task.output_log or "",
            "start_time": task.start_time.isoformat() if task.start_time else None,
            "end_time": task.end_time.isoformat() if task.end_time else None,
            "timeout": task.timeout,
            "created_at": task.created_at.isoformat()
        }


async def cancel_task(task_id: str) -> bool:
    """
    取消正在运行的任务
    """
    if task_id in _running_tasks:
        _running_tasks[task_id].cancel()
        try:
            await _running_tasks[task_id]
        except asyncio.CancelledError:
            pass
        return True
    
    with get_db_session() as db:
        task = db.query(Task).filter(Task.task_id == task_id).first()
        if task and task.status in ("pending", "running"):
            task.status = "cancelled"
            task.end_time = datetime.now(UTC)
            db.commit()
            return True
        elif task and task.status in ("success", "failed", "timeout", "cancelled"):
            return True
    
    return True


def is_project_locked(project_name: str) -> bool:
    """
    检查项目是否有正在运行的任务
    """
    lock = _project_locks.get(project_name)
    if lock and lock.locked():
        return True
    
    with get_db_session() as db:
        running_tasks = db.query(Task).filter(
            Task.project_name == project_name,
            Task.status == "running"
        ).count()
        return running_tasks > 0


def get_running_task(project_name: str) -> Optional[str]:
    """
    获取项目正在运行的任务ID
    """
    with get_db_session() as db:
        task = db.query(Task).filter(
            Task.project_name == project_name,
            Task.status == "running"
        ).first()
        return task.task_id if task else None