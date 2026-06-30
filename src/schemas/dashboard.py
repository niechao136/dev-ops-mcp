from pydantic import BaseModel, Field


class DashboardStats(BaseModel):
    project_count: int = Field(..., description="项目总数")
    api_key_count: int = Field(..., description="API 密钥总数")
    user_count: int = Field(..., description="用户总数")
    audit_log_count: int = Field(..., description="操作日志总数")


class SystemMetrics(BaseModel):
    cpu_usage: float = Field(..., description="CPU 使用率(%)")
    mem_usage: float = Field(..., description="内存使用率(%)")
    mem_total_gb: float = Field(..., description="总内存(GB)")
    mem_used_gb: float = Field(..., description="已用内存(GB)")
    disk_usage: float = Field(..., description="磁盘使用率(%)")
    disk_total_gb: float = Field(..., description="总磁盘(GB)")
    disk_free_gb: float = Field(..., description="可用磁盘(GB)")
    node_name: str = Field(..., description="节点名称")
