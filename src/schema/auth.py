from enum import Enum
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class TokenDict(BaseModel):
    id: int = Field(..., description="用户 ID")
    name: str = Field(..., description="用户名")
    role: UserRole = Field(..., description="用户权限")


class UserLogin(BaseModel):
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")
