from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

from .api import PageParams


class ProjectPageParams(PageParams):
    order_by: Optional[str] = Field(default="name", description="排序字段")

    @field_validator('order_by')
    @classmethod
    def validate_order_by(cls, v):
        allowed_fields = {'name', 'work_dir', 'is_active'}
        if v and v not in allowed_fields:
            raise ValueError(f'排序字段必须在 {allowed_fields} 内')
        return v


class ProjectInfo(BaseModel):
    id: int = Field(..., description="项目 ID")
    name: str = Field(..., description="项目名称")
    description: Optional[str] = Field(default=None, description="项目描述")
    work_dir: str = Field(..., description="工作目录")
    is_active: bool = Field(default=True, description="是否激活")
    command_count: Optional[int] = Field(default=0, description="命令数量")


class ProjectAdd(BaseModel):
    name: str = Field(..., description="项目名称")
    description: Optional[str] = Field(default=None, description="项目描述")
    work_dir: str = Field(..., description="工作目录")


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, description="项目名称")
    description: Optional[str] = Field(default=None, description="项目描述")
    work_dir: Optional[str] = Field(default=None, description="工作目录")
    is_active: Optional[bool] = Field(default=None, description="是否激活")


class ProjectDel(BaseModel):
    ids: List[int] = Field(description="项目 ID 数组")


class CommandInfo(BaseModel):
    id: int = Field(..., description="命令 ID")
    project_id: int = Field(..., description="项目 ID")
    action_type: str = Field(..., description="操作类型")
    description: Optional[str] = Field(default=None, description="描述")
    shell_command: str = Field(..., description="Shell 命令")
    timeout: int = Field(default=600, description="超时时间(秒)")
    default_params: Optional[dict] = Field(default=None, description="可选参数默认值")


class CommandAdd(BaseModel):
    project_id: int = Field(..., description="项目 ID")
    action_type: str = Field(..., description="操作类型")
    description: Optional[str] = Field(default=None, description="描述")
    shell_command: str = Field(..., description="Shell 命令")
    timeout: int = Field(default=60, ge=1, le=3600, description="超时时间(秒)")
    default_params: Optional[dict] = Field(default=None, description="可选参数默认值")


class CommandUpdate(BaseModel):
    action_type: Optional[str] = Field(default=None, description="操作类型")
    description: Optional[str] = Field(default=None, description="描述")
    shell_command: Optional[str] = Field(default=None, description="Shell 命令")
    timeout: Optional[int] = Field(default=None, ge=1, le=3600, description="超时时间(秒)")
    default_params: Optional[dict] = Field(default=None, description="可选参数默认值")


class CommandDel(BaseModel):
    ids: List[int] = Field(description="命令 ID 数组")


class CommandExecute(BaseModel):
    project_name: str = Field(..., description="项目名称")
    action: str = Field(..., description="操作类型")
    params: Optional[dict] = Field(default=None, description="参数字典，用于替换脚本中的 ${参数名} 占位符")
