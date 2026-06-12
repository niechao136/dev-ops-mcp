from pydantic import BaseModel, Field


class DashboardStats(BaseModel):
    project_count: int = Field(..., description="项目总数")
    api_key_count: int = Field(..., description="API 密钥总数")
    user_count: int = Field(..., description="用户总数")
    audit_log_count: int = Field(..., description="操作日志总数")
