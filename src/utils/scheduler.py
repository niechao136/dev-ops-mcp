import asyncio
import re
from datetime import datetime, UTC
from typing import Dict, Optional, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.dbs.db import get_db_session
from src.dbs.orm import Automation, Project, Command, AuditLog
from src.utils.executor import execute_shell_script
from src.utils.task_executor import submit_task

_scheduler = None
_running_checkers: Dict[int, asyncio.Task] = {}


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="UTC")
    return _scheduler


async def execute_automation_command(automation: Automation):
    with get_db_session() as db:
        project = db.query(Project).filter(Project.id == automation.project_id).first()
        command = db.query(Command).filter(Command.id == automation.command_id).first()

        if not project or not command:
            return

        command_list = [line.strip() for line in command.shell_command.splitlines() if line.strip()]
        if not command_list:
            return

        command_details = {
            "script": command.shell_command,
            "params": {},
            "default_params": command.default_params,
            "automation_id": automation.id,
            "automation_name": automation.name
        }

        task_id = submit_task(
            project_name=project.name,
            action=command.action_type,
            commands=command_list,
            work_dir=command.work_dir or project.work_dir,
            timeout=command.timeout,
            actor_type="automation",
            actor_id=automation.id,
            command_details=command_details
        )

        automation.last_run_time = datetime.now(UTC)
        automation.last_run_status = "running"
        db.commit()


async def check_condition(automation: Automation):
    with get_db_session() as db:
        project = db.query(Project).filter(Project.id == automation.project_id).first()
        if not project or not automation.condition_script:
            return

        script_lines = [line.strip() for line in automation.condition_script.splitlines() if line.strip()]
        if not script_lines:
            return

        try:
            for script in script_lines:
                exit_code, status, _ = await execute_shell_script(script, project.work_dir, 30)
                if exit_code != 0:
                    return

            await execute_automation_command(automation)

        except Exception:
            pass


async def condition_checker_loop(automation: Automation):
    interval = automation.condition_interval or 60
    while True:
        try:
            with get_db_session() as db:
                auto = db.query(Automation).filter(Automation.id == automation.id).first()
                if not auto or not auto.is_enabled:
                    break

            await check_condition(automation)
            await asyncio.sleep(interval)

        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(interval)


def parse_cron_expression(cron_expr: str) -> Optional[str]:
    parts = cron_expr.strip().split()
    if len(parts) == 5:
        return cron_expr
    return None


def start_automation(automation: Automation):
    scheduler = get_scheduler()

    if automation.trigger_type == "cron":
        cron_expr = parse_cron_expression(automation.cron_expression or "")
        if cron_expr:
            parts = cron_expr.split()
            scheduler.add_job(
                execute_automation_command,
                "cron",
                args=[automation],
                id=f"automation_{automation.id}",
                minute=parts[0],
                hour=parts[1],
                day=parts[2],
                month=parts[3],
                day_of_week=parts[4],
                replace_existing=True
            )

    elif automation.trigger_type == "condition":
        if automation.id in _running_checkers:
            _running_checkers[automation.id].cancel()

        task = asyncio.create_task(condition_checker_loop(automation))
        _running_checkers[automation.id] = task


def stop_automation(automation_id: int):
    scheduler = get_scheduler()
    scheduler.remove_job(f"automation_{automation_id}")

    if automation_id in _running_checkers:
        _running_checkers[automation_id].cancel()
        del _running_checkers[automation_id]


def start_all_automations():
    with get_db_session() as db:
        automations = db.query(Automation).filter(Automation.is_enabled == True).all()
        for automation in automations:
            start_automation(automation)


def start_scheduler():
    scheduler = get_scheduler()
    start_all_automations()
    scheduler.start()


def stop_scheduler():
    scheduler = get_scheduler()
    scheduler.shutdown(wait=False)

    for task in _running_checkers.values():
        task.cancel()
    _running_checkers.clear()