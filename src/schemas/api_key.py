from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

from .api import PageParams

# 可用的 scope 取值
VALID_SCOPES = {"ops:execute", "resources:read", "resources:write"}


def _validate_scopes(scopes: Optional[List[str]]) -> Optional[List[str]]:
    if scopes is None:
        return None
    invalid = [s for s in scopes if s not in VALID_SCOPES]
    if invalid:
        raise ValueError(f"非法 scope: {invalid}，允许的取值为 {sorted(VALID_SCOPES)}")
    return scopes


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
    scopes: Optional[List[str]] = Field(
        None,
        description="权限范围列表；可选值: ops:execute(运维执行,默认) / resources:read(资源只读) / resources:write(资源管理写)",
    )

    @field_validator('scopes')
    @classmethod
    def check_scopes(cls, v):
        return _validate_scopes(v)


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, description="密钥别名")
    allowed_projects: Optional[List[str]] = Field(None, description="允许访问的项目名列表，None 代表全部权限")
    scopes: Optional[List[str]] = Field(None, description="权限范围列表，传入时整体替换")
    is_active: Optional[bool] = Field(None, description="是否启用")

    @field_validator('scopes')
    @classmethod
    def check_scopes(cls, v):
        return _validate_scopes(v)


class ApiKeyItem(BaseModel):
    id: int = Field(..., description="密钥ID")
    token_name: str = Field(..., description="密钥别名")
    token_prefix: Optional[str] = Field(None, description="密钥前缀，用于显示")
    allowed_projects: Optional[List[str]] = Field(None, description="允许访问的项目名列表，None 代表全部权限")
    scopes: Optional[List[str]] = Field(None, description="权限范围列表，None 表示默认 ops:execute")
    is_active: bool = Field(..., description="是否启用")
    created_by: int = Field(..., description="创建者用户ID")
    created_by_name: Optional[str] = Field(None, description="创建者用户名")


class ApiKeyDetail(ApiKeyItem):
    pass


class ApiKeyCreated(BaseModel):
    id: int = Field(..., description="密钥ID")
    name: str = Field(..., description="密钥别名")
    key: str = Field(..., description="密钥内容，用于复制")
    prefix: Optional[str] = Field(None, description="密钥前缀，用于显示")


class ApiKeyDelete(BaseModel):
    ids: List[int] = Field(..., description="要删除的密钥ID列表")
