from fastapi import APIRouter, Depends, Request, Response
from starlette.responses import JSONResponse
from starlette.types import Receive, Scope, Send
from urllib.parse import parse_qs

from src.db.db import get_db_session
from src.db.orm import ApiToken
from src.tool.mcp import mcp, sse_transport
from src.util.auth import get_api_key
from src.util.context import current_mcp_token
from src.util.security import verify_api_key


mcp_router = APIRouter(
    prefix="/mcp",
    tags=["MCP 模块"],
    dependencies=[Depends(get_api_key)],
)


@mcp_router.get("/sse")
async def handle_mcp_sse(request: Request, token: ApiToken = Depends(get_api_key)):
    """
    大模型客户端（连接发起方）访问此接口建立 SSE 长连接。
    服务器会通过此通道持续向大模型推送可用的工具列表和通知。
    """
    ctx_token = current_mcp_token.set(token)
    try:
        async with sse_transport.connect_sse(
                request.scope,
                request.receive,
                request._send
        ) as streams:
            # 将当前的 SSE 连接和 FastMCP 的引擎连通
            await mcp._mcp_server.run(
                streams[0],
                streams[1],
                mcp._mcp_server.create_initialization_options()
            )
    finally:
        # 协程结束后自动重置，防止内存泄漏
        current_mcp_token.reset(ctx_token)


async def handle_mcp_messages_raw(request: Request):
    """
    通过原生 ASGI 管道处理大模型的 Tool 调用请求。
    """
    scope: Scope = request.scope
    receive: Receive = request.receive
    send: Send = request._send  # 使用 request 的私有发送通道
    # 1. 从原生底层提取凭证 (优先从 Headers 读)
    api_key = None
    headers = dict(scope.get("headers", []))
    
    if b"x-api-key" in headers:
        api_key = headers[b"x-api-key"].decode("utf-8")
    elif b"authorization" in headers:
        auth_str = headers[b"authorization"].decode("utf-8")
        if auth_str.startswith("Bearer "):
            api_key = auth_str[7:]

    if not api_key:
        # scope.get("query_string") 拿到的是 bytes，例如 b"token=9c8fac92...&foo=bar"
        query_string = scope.get("query_string", b"").decode("utf-8")
        
        if query_string:
            # parse_qs 会将字符串解析为字典，格式为：{"token": ["9c8fac92..."], "foo": ["bar"]}
            query_params = parse_qs(query_string)
            
            # 依次尝试获取 token 或 api_key（因为返回的是列表，我们取 [0]）
            api_key_list = query_params.get("token") or query_params.get("api_key")
            if api_key_list:
                api_key = api_key_list[0]

    if not api_key:
        res = JSONResponse({"detail": "缺失凭证：请通过 Header (X-API-Key / Authorization) 或 URL 参数 (token / api_key) 提供 API Key。"}, status_code=401)
        await res(scope, receive, send)
        return

    # 2. 数据库安全校验
    incoming_prefix = api_key[:8]
    token_record = None

    with get_db_session() as db:
        candidates = db.query(ApiToken).filter(
            ApiToken.token_prefix == incoming_prefix,
            ApiToken.is_active == True
        ).all()
        
        for candidate in candidates:
            if verify_api_key(api_key, candidate.token_hash):
                token_record = candidate
                break

    if not token_record:
        res = JSONResponse({"detail": "无效或已被禁用的 API Key"}, status_code=401)
        await res(scope, receive, send)
        return

    # 3. 校验通过，移交 MCP 传输层接管
    ctx_token = current_mcp_token.set(token_record)
    try:
        # 此时 MCP 响应完 202 后直接结束，FastAPI 毫无插手机会，完美规避冲突
        await sse_transport.handle_post_message(scope, receive, send)
    finally:
        current_mcp_token.reset(ctx_token)
