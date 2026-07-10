from typing import Optional
from pydantic import BaseModel, Field


class AutomationAdd(BaseModel):
    project_id: int = Field(..., description="项目 ID")
    name: str = Field(..., description="规则名称")
    trigger_type: str = Field(..., description="触发类型: cron/condition")
    cron_expression: Optional[str] = Field(default=None, description="cron 表达式")
    condition_script: Optional[str] = Field(default=None, description="检查脚本")
    condition_interval: Optional[int] = Field(default=60, description="检查间隔(秒)")
    command_id: int = Field(..., description="执行命令 ID")
    is_enabled: Optional[bool] = Field(default=True, description="是否启用")


class AutomationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, description="规则名称")
    trigger_type: Optional[str] = Field(default=None, description="触发类型: cron/condition")
    cron_expression: Optional[str] = Field(default=None, description="cron 表达式")
    condition_script: Optional[str] = Field(default=None, description="检查脚本")
    condition_interval: Optional[int] = Field(default=None, description="检查间隔(秒)")
    command_id: Optional[int] = Field(default=None, description="执行命令 ID")
    is_enabled: Optional[bool] = Field(default=None, description="是否启用")


class AutomationInfo(BaseModel):
    id: int = Field(..., description="规则 ID")
    project_id: int = Field(..., description="项目 ID")
    project_name: str = Field(..., description="项目名称")
    name: str = Field(..., description="规则名称")
    trigger_type: str = Field(..., description="触发类型: cron/condition")
    cron_expression: Optional[str] = Field(default=None, description="cron 表达式")
    condition_script: Optional[str] = Field(default=None, description="检查脚本")
    condition_interval: Optional[int] = Field(default=None, description="检查间隔(秒)")
    command_id: int = Field(..., description="执行命令 ID")
    command_action: str = Field(..., description="命令操作类型")
    command_description: Optional[str] = Field(default=None, description="命令描述")
    is_enabled: bool = Field(..., description="是否启用")
    last_run_time: Optional[str] = Field(default=None, description="最后执行时间")
    last_run_status: Optional[str] = Field(default=None, description="最后执行状态")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")