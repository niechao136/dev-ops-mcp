from fastapi import APIRouter, Depends

from src.db.db import get_db_session
from src.db.orm import Project, ApiToken, User, AuditLog
from src.schema.api import DataResult
from src.schema.dashboard import DashboardStats
from src.util.auth import get_current_user


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
