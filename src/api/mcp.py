from fastapi import APIRouter, Depends, Request, Response

from src.db.orm import ApiToken
from src.tool.mcp import mcp, sse_transport
from src.util.auth import get_api_key
from src.util.context import current_mcp_token


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


@mcp_router.post("/messages")
async def handle_mcp_messages(request: Request, token: ApiToken = Depends(get_api_key)):
    """
    大模型决定调用某个 Tool 时，其数据报文会以 POST 请求的形式打到这个接口。
    """
    ctx_token = current_mcp_token.set(token)
    try:
        await sse_transport.handle_post_message(
            request.scope,
            request.receive,
            request._send
        )
        return Response()
    finally:
        current_mcp_token.reset(ctx_token)
