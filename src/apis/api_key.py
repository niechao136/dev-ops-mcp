import json
from sqlalchemy import asc, desc, or_
from sqlalchemy.orm import joinedload
from fastapi import APIRouter, Depends
from typing import Annotated

from src.dbs.db import get_db_session
from src.dbs.orm import ApiToken, User
from src.schemas.api import DataResult, PageResult
from src.schemas.api_key import ApiKeyCreate, ApiKeyCreated, ApiKeyItem, ApiKeyPageParams, ApiKeyUpdate, ApiKeyDelete, ApiKeyDetail
from src.utils.auth import get_current_admin
from src.utils.security import generate_api_key, encrypt_api_key, decrypt_api_key


api_key_router = APIRouter(
    prefix="/api_key",
    tags=["API Key 管理"],
    dependencies=[Depends(get_current_admin)]
)


# =====================================================================
# 1. 创建密钥 (Create)
# =====================================================================
@api_key_router.post(
    path="",
    response_model=DataResult[ApiKeyCreated],
    summary="创建 API 密钥",
    description="生成一个新的 API 密钥，返回仅显示一次的明文密钥。支持设置名称、项目权限",
)
async def create_token(
        payload: ApiKeyCreate,
        current_admin: Annotated[User, Depends(get_current_admin)],
):
    """
    创建一个新的大模型/MCP 专属 API Key。
    """
    # 生成 (明文, 哈希, 前缀)
    plain_key, key_hash, prefix = generate_api_key()

    # 将明文通过 Fernet 强加密为二进制密文准备存库
    encrypted_bytes = encrypt_api_key(plain_key)

    # 格式化项目白名单
    allowed_projects_json = json.dumps(payload.allowed_projects) if payload.allowed_projects is not None else None

    # 构建 ORM 模型
    new_token = ApiToken(
        token_name=payload.name,
        encrypted_token=encrypted_bytes,
        token_hash=key_hash,
        token_prefix=prefix,
        allowed_projects=allowed_projects_json,
        is_active=True,
        creator=current_admin  # 直接利用关系绑定当前登录的 Admin 对象
    )

    with get_db_session() as db:
        db.add(new_token)
        db.commit()
        db.refresh(new_token)

    # 只在此处返回一次明文密钥给前端提示用户复制
    return DataResult(
        status=1,
        data=ApiKeyCreated(
            id=new_token.id,
            name=new_token.token_name,
            prefix=prefix,
            key=plain_key,
        ),
    )


# =====================================================================
# 2. 分页/列表获取密钥 (Read List)
# =====================================================================
@api_key_router.get(
    path="",
    response_model=PageResult[ApiKeyItem],
    summary="查询 API 密钥列表",
    description="分页获取 API 密钥列表。支持按名称搜索，支持排序和分页。",
)
async def list_tokens(
        params: Annotated[ApiKeyPageParams, Depends()],
):
    """
    获取系统中所有 API Key 的列表。
    """
    with get_db_session() as db:
        query = db.query(ApiToken).options(joinedload(ApiToken.creator))
        
        # 搜索功能
        if params.keyword:
            search = f"%{params.keyword}%"
            query = query.filter(
                or_(
                    ApiToken.token_name.ilike(search)
                )
            )
        
        total = query.count()
        
        # 排序
        if params.order_by:
            order_column = getattr(ApiToken, params.order_by)
            if params.direction == "asc":
                query = query.order_by(asc(order_column))
            else:
                query = query.order_by(desc(order_column))

        # 分页
        records = query.offset(params.offset).limit(params.size).all()

        result_items = []
        for r in records:
            # 将数据库内的 JSON 文本反序列化为 Python 列表
            projects_list = json.loads(r.allowed_projects) if r.allowed_projects else None

            result_items.append(ApiKeyItem(
                id=r.id,
                token_name=r.token_name,
                token_prefix=r.token_prefix,
                allowed_projects=projects_list,
                is_active=r.is_active,
                created_by=r.created_by,
                created_by_name=r.creator.username if r.creator else None
            ))

    return PageResult(
        total=total,
        data=result_items,
        page=params.page,
        size=params.size,
    )


# =====================================================================
# 3. 获取单个密钥详情 (Read Detail)
# =====================================================================
@api_key_router.get(
    path="/{key_id}",
    response_model=DataResult[ApiKeyDetail],
    summary="获取 API 密钥详情",
    description="获取指定 ID 的 API 密钥详情。"
)
async def get_token_detail(key_id: int):
    with get_db_session() as db:
        token = db.query(ApiToken).options(joinedload(ApiToken.creator)).filter(ApiToken.id == key_id).first()
        
        if not token:
            return DataResult(status=0, msg="密钥不存在")
        
        projects_list = json.loads(token.allowed_projects) if token.allowed_projects else None
        
        return DataResult(
            status=1,
            data=ApiKeyDetail(
                id=token.id,
                token_name=token.token_name,
                token_prefix=token.token_prefix,
                allowed_projects=projects_list,
                is_active=token.is_active,
                created_by=token.created_by,
                created_by_name=token.creator.username if token.creator else None
            )
        )


# =====================================================================
# 4. 更新密钥 (Update)
# =====================================================================
@api_key_router.put(
    path="/{key_id}",
    response_model=DataResult[bool],
    summary="更新 API 密钥",
    description="更新 API 密钥的名称、权限或启用状态。"
)
async def update_token(
    key_id: int,
    payload: ApiKeyUpdate
):
    with get_db_session() as db:
        token = db.query(ApiToken).filter(ApiToken.id == key_id).first()
        
        if not token:
            return DataResult(status=0, msg="密钥不存在")
        
        if payload.name is not None:
            token.token_name = payload.name
        
        if payload.allowed_projects is not None:
            token.allowed_projects = json.dumps(payload.allowed_projects)
        
        if payload.is_active is not None:
            token.is_active = payload.is_active
        
        db.commit()
        return DataResult(status=1, data=True, msg="更新成功")


# =====================================================================
# 5. 删除密钥 (Delete)
# =====================================================================
@api_key_router.delete(
    path="",
    response_model=DataResult[bool],
    summary="删除 API 密钥",
    description="批量删除 API 密钥。"
)
async def delete_tokens(
    payload: ApiKeyDelete
):
    with get_db_session() as db:
        deleted_count = db.query(ApiToken).filter(
            ApiToken.id.in_(payload.ids)
        ).delete(synchronize_session=False)
        
        db.commit()
        return DataResult(status=1, data=True, msg=f"成功删除 {deleted_count} 个密钥")


# =====================================================================
# 6. 获取密钥总数 (Count)
# =====================================================================
@api_key_router.get(
    path="/count",
    response_model=DataResult[int],
    summary="获取 API 密钥总数",
    description="获取系统中 API 密钥的总数。"
)
async def count_tokens():
    with get_db_session() as db:
        count = db.query(ApiToken).count()
        return DataResult(status=1, data=count)


# =====================================================================
# 8. 获取完整密钥 (Get Full Key)
# =====================================================================
@api_key_router.post(
    path="/{key_id}/get_key",
    response_model=DataResult[str],
    summary="获取完整 API 密钥",
    description="解密并返回完整的 API 密钥，用于复制。"
)
async def get_full_key(key_id: int):
    with get_db_session() as db:
        token = db.query(ApiToken).filter(ApiToken.id == key_id).first()
        
        if not token:
            return DataResult(status=0, msg="密钥不存在")
        
        if not token.is_active:
            return DataResult(status=0, msg="密钥已禁用")
        
        try:
            plain_key = decrypt_api_key(token.encrypted_token)
            return DataResult(status=1, data=plain_key)
        except Exception:
            return DataResult(status=0, msg="密钥解密失败")


# =====================================================================
# 7. 重新生成密钥 (Regenerate)
# =====================================================================
@api_key_router.post(
    path="/{key_id}/regenerate",
    response_model=DataResult[ApiKeyCreated],
    summary="重新生成 API 密钥",
    description="为现有密钥重新生成一个新的密钥值，旧密钥立即失效。"
)
async def regenerate_token(
    key_id: int,
    current_admin: Annotated[User, Depends(get_current_admin)]
):
    with get_db_session() as db:
        token = db.query(ApiToken).filter(ApiToken.id == key_id).first()
        
        if not token:
            return DataResult(status=0, msg="密钥不存在")
        
        # 生成新密钥
        plain_key, key_hash, prefix = generate_api_key()
        encrypted_bytes = encrypt_api_key(plain_key)
        
        # 更新数据库
        token.encrypted_token = encrypted_bytes
        token.token_hash = key_hash
        token.token_prefix = prefix
        
        db.commit()
        db.refresh(token)
        
        return DataResult(
            status=1,
            data=ApiKeyCreated(
                id=token.id,
                name=token.token_name,
                prefix=prefix,
                key=plain_key,
            ),
            msg="密钥已重新生成"
        )
