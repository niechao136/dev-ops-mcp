from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from typing import Optional

from src.dbs.db import get_db_session
from src.dbs.orm import ApiToken
from src.utils.context import current_mcp_token
from src.utils.security import verify_api_key


class MCPAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        
        if path.startswith("/mcp/sse"):
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
                return JSONResponse(
                    status_code=401,
                    content={"detail": "缺失凭证：请通过 Header (X-API-Key / Authorization) 或 URL 参数 (token / api_key) 提供 API Key。"}
                )
            
            incoming_prefix = api_key[:8]
            with get_db_session() as db:
                candidates = db.query(ApiToken).filter(
                    ApiToken.token_prefix == incoming_prefix,
                    ApiToken.is_active == True
                ).all()

            token_record: Optional[ApiToken] = None
            for candidate in candidates:
                # 此时 candidate.token_hash 是活生生的数据库字符串了！
                if verify_api_key(api_key, candidate.token_hash):
                    token_record = candidate
                    break

            if not token_record:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "无效或已被禁用的 API Key"}
                )
            
            ctx_token = current_mcp_token.set(token_record)

            try:
                response = await call_next(request)
                return response
            finally:
                # 同样在 finally 块中完美重置，保证上下文安全
                current_mcp_token.reset(ctx_token)
                
        # 非 /mcp/ 路径无需拦截，直接放行
        return await call_next(request)
