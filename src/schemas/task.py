from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

from .api import PageParams


class TaskInfo(BaseModel):
    task_id: str = Field(..., description="任务ID")
    project_name: str = Field(..., description="项目名称")
    action: str = Field(..., description="操作类型")
    status: str = Field(..., description="任务状态")
    output_log: Optional[str] = Field(default=None, description="输出日志（增量内容）")
    next_offset: int = Field(default=0, description="下次调用时传入的 log_offset 值")
    start_time: Optional[str] = Field(default=None, description="开始时间")
    end_time: Optional[str] = Field(default=None, description="结束时间")
    timeout: int = Field(default=600, description="超时时间(秒)")
    created_at: str = Field(..., description="创建时间")


class TaskSubmitResult(BaseModel):
    task_id: str = Field(..., description="任务ID")
    status: str = Field(..., description="初始状态")
    message: str = Field(..., description="提示信息")