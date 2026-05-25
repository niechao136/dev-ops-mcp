from fastapi import Request, HTTPException, Depends, Header, status
from pydantic import ValidationError
from typing import Annotated, List

from src.db.db import get_db_session
from src.db.orm import ApiToken
from src.schema.auth import TokenDict, UserRole
from src.util.context import current_mcp_token
from src.util.jwt import verify_access_token
from src.util.security import encrypt_api_key


ALLOW_ROLE: List[UserRole] = [UserRole.ADMIN]


async def get_current_user(
        authorization: Annotated[str, Header()] = None
) -> TokenDict:
    """
    从请求头 Authorization: Bearer <token> 获取当前用户
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"})

    token = authorization[7:]
    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalid or expired")

    try:
        return TokenDict(**payload)
    except ValidationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token data corrupted"
        )


async def get_current_admin(
        current_user: Annotated[TokenDict, Depends(get_current_user)]
) -> TokenDict:
    if current_user.role not in ALLOW_ROLE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required roles: {ALLOW_ROLE}")
    return current_user


async def get_api_key(request: Request) -> ApiToken:
    # 1. 尝试从自定义 Header "X-API-Key" 中获取
    api_key = request.headers.get("X-API-Key")
    # 2. 如果没拿到，尝试从标准的 "Authorization: Bearer XX" 中获取
    if not api_key:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            api_key = auth_header[7:]

    # 3. 如果 Header 都没有，尝试从 URL Query 参数中获取
    # 支持 ?token=XX 或 ?api_key=XX
    if not api_key:
        api_key = request.query_params.get("token") or request.query_params.get("api_key")

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺失凭证：请通过 Header (X-API-Key / Authorization) 或 URL 参数 (token / api_key) 提供 API Key。"
        )

    key_encrypted = encrypt_api_key(api_key)

    with get_db_session() as db:
        token_record = db.query(ApiToken).filter(
            ApiToken.encrypted_token == key_encrypted,
            ApiToken.is_active == True
        ).first()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或已被禁用的 API Key"
        )

    current_mcp_token.set(token_record)

    return token_record

