from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

from .auth import UserRole
from .api import PageParams


class UserPageParams(PageParams):
    order_by: Optional[str] = Field(default="username", description="排序字段")

    @field_validator('order_by')
    @classmethod
    def validate_order_by(cls, v):
        # 允许排序的字段白名单
        allowed_fields = {'username', 'email', 'role'}
        if v and v not in allowed_fields:
            raise ValueError(f'排序字段必须在 {allowed_fields} 内')
        return v


class UserInfo(BaseModel):
    id: int = Field(..., description="用户 ID")
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(default=None, description="用户邮箱")
    role: UserRole = Field(..., description="用户权限")
    is_active: bool = Field(..., description="是否启用")
    created_at: datetime = Field(..., description="创建时间（ISO格式）")


class UserAdd(BaseModel):
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(default=None, description="用户邮箱")
    password: str = Field(..., description="密码")
    role: UserRole = Field(..., description="用户权限")


class UserUpdate(BaseModel):
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(default=None, description="用户邮箱")
    role: UserRole = Field(..., description="用户权限")


class UserPassword(BaseModel):
    password: str = Field(..., description="密码")


class UserDel(BaseModel):
    ids: List[int] = Field(description="用户 ID 数组")
