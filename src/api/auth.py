from typing import Annotated
from fastapi import APIRouter, Body

from src.db.db import get_db_session
from src.db.orm import User
from src.schema.api import DataResult
from src.schema.auth import UserLogin, TokenDict
from src.util.jwt import create_access_token
from src.util.security import pwd_context


auth_router = APIRouter(
    prefix="/auth",
    tags=["Auth 模块"]
)


@auth_router.post(
    path="/login",
    response_model=DataResult[str],
    summary="用户登录",
    description="验证用户名和密码，成功后返回 JWT Token。如果当前浏览器存在匿名会话，会自动合并至登录账号。",
)
async def login(
    user: Annotated[UserLogin, Body(description="用户登录凭证")],
):
    with get_db_session() as db:
        row = db.query(User).filter(User.username == user.username).first()

    if not row or not pwd_context.verify(user.password, row.password_hash):
        return DataResult(status=0, msg="Username or password is incorrect")

    token = create_access_token(TokenDict(id=row.id, name=user.username, role=row.role))
    return DataResult(status=1, data=token)
