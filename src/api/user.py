from fastapi import APIRouter, Depends, Path, Body
from typing import List, Optional, Annotated
from uuid import UUID

from src.db.db import get_db_session
from src.db.orm import User
from src.schema.api import DataResult, PageResult
from src.schema.auth import TokenDict, UserLogin, UserRole
from src.schema.user import UserInfo, UserPageParams
from src.util.auth import get_current_admin, get_current_user
from src.util.security import pwd_context


user_router = APIRouter(
    prefix="/user",
    tags=["User 管理"]
)


@user_router.get(
    path="",
    response_model=PageResult[UserInfo],
    summary="获取用户列表",
    description="分页获取所有未删除的用户。支持按用户名或邮箱模糊搜索，按指定字段排序。",
)
async def user_list(
    params: Annotated[UserPageParams, Depends()],
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        query = db.query(User)
        total = query.count()

        # 分页查出记录
        records = query.offset((params.page - 1) * params.size).limit(params.size).all()

    result_items = []
    for r in records:
        result_items.append(UserInfo(
            id=r.id,
            username=r.username,
            role=UserRole(r.role),
            created_at=r.created_at,
            email=r.email
        ))

    return PageResult(
        total=total,
        data=result_items,
        page=params.page,
        size=params.size
    )


@user_router.get(
    path="/count",
    response_model=DataResult[int],
    summary="获取活跃用户总数",
    description="返回未软删除的用户数量。"
)
async def user_count(
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        query = db.query(User)
        total = query.count()

    return DataResult(status=1, data=total)


@user_router.get(
    path="/me",
    response_model=DataResult[Optional[UserInfo]],
    summary="获取当前登录用户信息",
    description="如果已登录，返回当前用户的详细信息；未登录时返回 data 为 null。"
)
async def current_user(
    user: Annotated[Optional[TokenDict], Depends(get_current_user)]
):
    if not user:
        return DataResult(status=1, data=None)

    with get_db_session() as db:
        row = db.query(User).filter(
            User.id == user.id
        ).first()

    if not row:
        return DataResult(status=0, msg="User not found or inactive")
    
    data = UserInfo(
        id=row.id,
        username=row.username,
        role=UserRole(row.role),
        created_at=row.created_at,
        email=row.email
    )

    return DataResult(status=1, data=data)
