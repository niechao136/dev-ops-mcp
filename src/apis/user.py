from fastapi import APIRouter, Depends, Path, Body
from typing import List, Optional, Annotated
from uuid import UUID
from sqlalchemy import asc, desc, or_

from src.dbs.db import get_db_session
from src.dbs.orm import User
from src.schemas.api import DataResult, PageResult
from src.schemas.auth import TokenDict, UserRole
from src.schemas.user import UserInfo, UserPageParams, UserAdd, UserUpdate, UserPassword, UserDel, UserChangePassword
from src.utils.auth import get_current_admin, get_current_user
from src.utils.security import pwd_context


user_router = APIRouter(
    prefix="/user",
    tags=["User 管理"]
)


@user_router.get(
    path="",
    response_model=PageResult[UserInfo],
    summary="获取用户列表",
    description="分页获取所有用户。支持按用户名或邮箱模糊搜索，按指定字段排序。",
)
async def user_list(
    params: Annotated[UserPageParams, Depends()],
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        query = db.query(User)
        
        # 搜索功能
        if params.keyword:
            search = f"%{params.keyword}%"
            query = query.filter(
                or_(
                    User.username.ilike(search),
                    User.email.ilike(search)
                )
            )
        
        total = query.count()
        
        # 排序
        if params.order_by:
            order_column = getattr(User, params.order_by)
            if params.direction == "asc":
                query = query.order_by(asc(order_column))
            else:
                query = query.order_by(desc(order_column))

        # 分页
        records = query.offset((params.page - 1) * params.size).limit(params.size).all()

    result_items = []
    for r in records:
        result_items.append(UserInfo(
            id=r.id,
            username=r.username,
            role=UserRole(r.role),
            created_at=r.created_at,
            email=r.email,
            is_active=r.is_active
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
    summary="获取用户总数",
    description="返回用户数量。"
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
        email=row.email,
        is_active=row.is_active
    )

    return DataResult(status=1, data=data)


@user_router.post(
    path="/me/password",
    response_model=DataResult,
    summary="修改当前用户密码",
    description="登录用户修改自己的密码，需要提供旧密码进行验证。"
)
async def change_my_password(
    password_data: UserChangePassword = Body(..., description="密码数据"),
    user: Annotated[Optional[TokenDict], Depends(get_current_user)] = None
):
    if not user:
        return DataResult(status=0, msg="请先登录")
    
    with get_db_session() as db:
        current_user = db.query(User).filter(User.id == user.id).first()
        
        if not current_user:
            return DataResult(status=0, msg="用户不存在")
        
        if not pwd_context.verify(password_data.old_password, current_user.password_hash):
            return DataResult(status=0, msg="旧密码不正确")
        
        current_user.password_hash = pwd_context.hash(password_data.new_password)
        db.commit()
        
        return DataResult(status=1, msg="密码修改成功")


@user_router.get(
    path="/{user_id}",
    response_model=DataResult[UserInfo],
    summary="获取用户详情",
    description="根据用户ID获取用户的详细信息。"
)
async def get_user(
    user_id: int = Path(..., description="用户ID"),
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return DataResult(status=0, msg="用户不存在")
        
        return DataResult(
            status=1,
            data=UserInfo(
                id=user.id,
                username=user.username,
                role=UserRole(user.role),
                created_at=user.created_at,
                email=user.email,
                is_active=user.is_active
            )
        )


@user_router.post(
    path="",
    response_model=DataResult[UserInfo],
    summary="创建用户",
    description="创建一个新用户。只有管理员可以创建用户。"
)
async def create_user(
    user_data: UserAdd,
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        # 检查用户名是否已存在
        existing = db.query(User).filter(User.username == user_data.username).first()
        if existing:
            return DataResult(status=0, msg="用户名已存在")
        
        # 创建新用户
        new_user = User(
            username=user_data.username,
            password_hash=pwd_context.hash(user_data.password),
            email=user_data.email,
            role=user_data.role.value,
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return DataResult(
            status=1,
            data=UserInfo(
                id=new_user.id,
                username=new_user.username,
                role=UserRole(new_user.role),
                created_at=new_user.created_at,
                email=new_user.email,
                is_active=new_user.is_active
            )
        )


@user_router.put(
    path="/{user_id}",
    response_model=DataResult[UserInfo],
    summary="更新用户",
    description="更新用户的基本信息。"
)
async def update_user(
    user_id: int = Path(..., description="用户ID"),
    user_data: UserUpdate = Body(..., description="用户信息"),
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return DataResult(status=0, msg="用户不存在")
        
        # 检查用户名是否重复
        if user.username != user_data.username:
            existing = db.query(User).filter(User.username == user_data.username).first()
            if existing:
                return DataResult(status=0, msg="用户名已存在")
        
        user.username = user_data.username
        user.email = user_data.email
        user.role = user_data.role.value
        if user_data.is_active is not None:
            user.is_active = user_data.is_active
        
        db.commit()
        db.refresh(user)
        
        return DataResult(
            status=1,
            data=UserInfo(
                id=user.id,
                username=user.username,
                role=UserRole(user.role),
                created_at=user.created_at,
                email=user.email,
                is_active=user.is_active
            )
        )


@user_router.post(
    path="/{user_id}/password",
    response_model=DataResult,
    summary="修改用户密码",
    description="修改指定用户的密码。只有管理员可以修改其他用户的密码。"
)
async def change_user_password(
    user_id: int = Path(..., description="用户ID"),
    password_data: UserPassword = Body(..., description="密码数据"),
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return DataResult(status=0, msg="用户不存在")
        
        user.password_hash = pwd_context.hash(password_data.password)
        db.commit()
        
        return DataResult(status=1, msg="密码修改成功")


@user_router.put(
    path="/{user_id}/toggle",
    response_model=DataResult[UserInfo],
    summary="启用/禁用用户",
    description="切换用户的启用状态。"
)
async def toggle_user_status(
    user_id: int = Path(..., description="用户ID"),
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return DataResult(status=0, msg="用户不存在")
        
        user.is_active = not user.is_active
        db.commit()
        db.refresh(user)
        
        return DataResult(
            status=1,
            data=UserInfo(
                id=user.id,
                username=user.username,
                role=UserRole(user.role),
                created_at=user.created_at,
                email=user.email,
                is_active=user.is_active
            )
        )


@user_router.delete(
    path="",
    response_model=DataResult,
    summary="删除用户",
    description="批量删除用户。"
)
async def delete_users(
    del_data: UserDel,
    _: TokenDict = Depends(get_current_admin)
):
    with get_db_session() as db:
        # 检查是否有用户ID
        if not del_data.ids:
            return DataResult(status=0, msg="请选择要删除的用户")
        
        # 删除用户
        db.query(User).filter(User.id.in_(del_data.ids)).delete(synchronize_session=False)
        db.commit()
        
        return DataResult(status=1, msg="删除成功")
