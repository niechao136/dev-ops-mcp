from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

from .api import PageParams


class PublicCommandPageParams(PageParams):
    keyword: Optional[str] = Field(default=None, description="搜索关键词")
    tags: Optional[str] = Field(default=None, description="标签筛选，逗号分隔")

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if v:
            # 将逗号分隔的字符串转换为列表
            return ','.join([t.strip() for t in v.split(',') if t.strip()])
        return v


class PublicCommandInfo(BaseModel):
    id: int = Field(..., description="命令 ID")
    name: str = Field(..., description="命令名称")
    action_type: str = Field(..., description="操作类型")
    description: Optional[str] = Field(default=None, description="描述")
    shell_command: str = Field(..., description="Shell 命令")
    timeout: int = Field(default=600, description="超时时间(秒)")
    default_params: Optional[dict] = Field(default=None, description="可选参数默认值")
    tags: Optional[str] = Field(default=None, description="标签，逗号分隔")
    is_active: bool = Field(default=True, description="是否启用")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")


class PublicCommandAdd(BaseModel):
    name: str = Field(..., description="命令名称")
    action_type: str = Field(..., description="操作类型")
    description: Optional[str] = Field(default=None, description="描述")
    shell_command: str = Field(..., description="Shell 命令")
    timeout: int = Field(default=60, ge=1, le=3600, description="超时时间(秒)")
    default_params: Optional[dict] = Field(default=None, description="可选参数默认值")
    tags: Optional[str] = Field(default=None, description="标签，逗号分隔")


class PublicCommandUpdate(BaseModel):
    name: Optional[str] = Field(default=None, description="命令名称")
    action_type: Optional[str] = Field(default=None, description="操作类型")
    description: Optional[str] = Field(default=None, description="描述")
    shell_command: Optional[str] = Field(default=None, description="Shell 命令")
    timeout: Optional[int] = Field(default=None, ge=1, le=3600, description="超时时间(秒)")
    default_params: Optional[dict] = Field(default=None, description="可选参数默认值")
    tags: Optional[str] = Field(default=None, description="标签，逗号分隔")
    is_active: Optional[bool] = Field(default=None, description="是否启用")


class PublicCommandDel(BaseModel):
    ids: List[int] = Field(description="命令 ID 数组")


class PublicCommandImport(BaseModel):
    """导入公共命令到项目"""
    public_command_id: int = Field(..., description="公共命令 ID")
    project_id: int = Field(..., description="目标项目 ID")


class PublicCommandBatchImport(BaseModel):
    """批量导入公共命令到项目"""
    public_command_ids: List[int] = Field(..., description="公共命令 ID 列表")
    project_id: int = Field(..., description="目标项目 ID")
