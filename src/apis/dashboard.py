import psutil
import socket

from fastapi import APIRouter, Depends

from src.dbs.db import get_db_session
from src.dbs.orm import Project, ApiToken, User, AuditLog
from src.schemas.api import DataResult
from src.schemas.dashboard import DashboardStats, SystemMetrics
from src.utils.auth import get_current_user


dashboard_router = APIRouter(
    prefix="/dashboard",
    tags=["仪表盘"]
)


@dashboard_router.get(
    path="/stats",
    response_model=DataResult[DashboardStats],
    summary="获取仪表盘统计数据",
    description="获取仪表盘所需的各种统计数据"
)
async def get_dashboard_stats(
    _ = Depends(get_current_user)
):
    with get_db_session() as db:
        project_count = db.query(Project).count()
        api_key_count = db.query(ApiToken).count()
        user_count = db.query(User).count()
        audit_log_count = db.query(AuditLog).count()
    
    return DataResult(
        status=1,
        data=DashboardStats(
            project_count=project_count,
            api_key_count=api_key_count,
            user_count=user_count,
            audit_log_count=audit_log_count
        )
    )


@dashboard_router.get(
    path="/metrics",
    response_model=DataResult[SystemMetrics],
    summary="获取系统指标",
    description="获取服务器 CPU、内存、磁盘使用情况"
)
async def get_system_metrics(
    _ = Depends(get_current_user)
):
    cpu_usage = psutil.cpu_percent(interval=1)
    
    mem = psutil.virtual_memory()
    mem_total_gb = mem.total / (1024 ** 3)
    mem_used_gb = mem.used / (1024 ** 3)
    
    disk = psutil.disk_usage('/')
    disk_total_gb = disk.total / (1024 ** 3)
    disk_free_gb = disk.free / (1024 ** 3)
    
    return DataResult(
        status=1,
        data=SystemMetrics(
            cpu_usage=cpu_usage,
            mem_usage=mem.percent,
            mem_total_gb=round(mem_total_gb, 2),
            mem_used_gb=round(mem_used_gb, 2),
            disk_usage=disk.percent,
            disk_total_gb=round(disk_total_gb, 2),
            disk_free_gb=round(disk_free_gb, 2),
            node_name=socket.gethostname()
        )
    )
