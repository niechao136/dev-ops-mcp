from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

from .api import PageParams


class ApiKeyPageParams(PageParams):
    order_by: Optional[str] = Field(default="created_at", description="排序字段")

    @field_validator('order_by')
    @classmethod
    def validate_order_by(cls, v):
        # 允许排序的字段白名单
        allowed_fields = {'created_at', 'token_name', 'is_active'}
        if v and v not in allowed_fields:
            raise ValueError(f'排序字段必须在 {allowed_fields} 内')
        return v


class ApiKeyCreate(BaseModel):
    name: str = Field(..., description="密钥别名")
    allowed_projects: Optional[List[str]] = Field(None, description="允许访问的项目名列表，None 代表全部权限")


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, description="密钥别名")
    allowed_projects: Optional[List[str]] = Field(None, description="允许访问的项目名列表，None 代表全部权限")
    is_active: Optional[bool] = Field(None, description="是否启用")


class ApiKeyItem(BaseModel):
    id: int = Field(..., description="密钥ID")
    token_name: str = Field(..., description="密钥别名")
    token_value: str = Field(..., description="密钥内容，用于复制")
    token_prefix: str = Field(..., description="密钥前缀，用于显示")
    allowed_projects: Optional[List[str]] = Field(None, description="允许访问的项目名列表，None 代表全部权限")
    is_active: bool = Field(..., description="是否启用")
    created_by: int = Field(..., description="创建时间（ISO格式）")


class ApiKeyCreated(BaseModel):
    id: int = Field(..., description="密钥ID")
    name: str = Field(..., description="密钥别名")
    key: str = Field(..., description="密钥内容，用于复制")
    prefix: str = Field(..., description="密钥前缀，用于显示")
