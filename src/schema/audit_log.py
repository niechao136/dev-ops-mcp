from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class ActorType(str, Enum):
    HUMAN = "human"
    AI = "ai"


class LogStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


class AuditLogPageParams(BaseModel):
    page: int = Field(1, ge=1, description="页码")
    size: int = Field(20, ge=1, le=100, description="每页数量")
    keyword: Optional[str] = Field(None, description="搜索关键词")
    actor_type: Optional[ActorType] = Field(None, description="操作者类型")
    action_category: Optional[str] = Field(None, description="操作分类")
    status: Optional[LogStatus] = Field(None, description="状态")
    target_project: Optional[str] = Field(None, description="目标项目")
    order_by: Optional[str] = Field("created_at", description="排序字段")
    direction: Optional[str] = Field("desc", description="排序方向")


class AuditLogInfo(BaseModel):
    id: int = Field(..., description="日志ID")
    actor_type: str = Field(..., description="操作者类型")
    actor_id: int = Field(..., description="操作者ID")
    actor_name: Optional[str] = Field(None, description="操作者名称")
    action_category: str = Field(..., description="操作分类")
    target_project: Optional[str] = Field(None, description="目标项目")
    action_details: Dict[str, Any] = Field(..., description="操作详情")
    status: str = Field(..., description="执行状态")
    output_log: Optional[str] = Field(None, description="输出日志")
    ip_address: Optional[str] = Field(None, description="IP地址")
    created_at: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


class AuditLogDelete(BaseModel):
    ids: List[int] = Field(..., description="要删除的日志ID列表")
