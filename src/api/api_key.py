import json
from fastapi import APIRouter, Depends
from typing import Annotated

from src.db.db import get_db_session
from src.db.orm import ApiToken, User
from src.schema.api import DataResult, PageResult
from src.schema.api_key import ApiKeyCreate, ApiKeyCreated, ApiKeyItem, ApiKeyPageParams
from src.util.auth import get_current_admin
from src.util.security import generate_api_key, encrypt_api_key, decrypt_api_key


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
    description="分页获取 API 密钥列表。支持按名称或描述模糊搜索，支持排序和分页。",
)
async def list_tokens(
        params: Annotated[ApiKeyPageParams, Depends()],
):
    """
    获取系统中所有 API Key 的列表。
    """
    with get_db_session() as db:
        query = db.query(ApiToken)
        total = query.count()

        # 分页查出记录
        records = query.offset((params.page - 1) * params.size).limit(params.size).all()

    result_items = []
    for r in records:
        # 将数据库内的 JSON 文本反序列化为 Python 列表
        projects_list = json.loads(r.allowed_projects) if r.allowed_projects else None
        plain_key = decrypt_api_key(r.encrypted_token) if r.encrypted_token else ""

        result_items.append(ApiKeyItem(
            id=r.id,
            token_name=r.token_name,
            token_value=plain_key,
            token_prefix=r.token_prefix,
            allowed_projects=projects_list,
            is_active=r.is_active,
            created_by=r.created_by
        ))

    return PageResult(
        total=total,
        data=result_items,
        page=params.page,
        size=params.size,
    )
