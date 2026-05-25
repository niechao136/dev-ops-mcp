from fastapi import APIRouter, Depends

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
async def handle_mcp_sse(token: ApiToken = Depends(get_api_key)):
    """
    大模型客户端（连接发起方）访问此接口建立 SSE 长连接。
    服务器会通过此通道持续向大模型推送可用的工具列表和通知。
    """
    ctx_token = current_mcp_token.set(token)
    try:
        async with sse_transport.connect_scope() as scope:
            # 将当前的 SSE 连接和 FastMCP 的引擎连通
            return await mcp.handle_sse_connection(scope)
    finally:
        # 协程结束后自动重置，防止内存泄漏
        current_mcp_token.reset(ctx_token)


@mcp_router.post("/messages")
async def handle_mcp_messages(token: ApiToken = Depends(get_api_key)):
    """
    大模型决定调用某个 Tool 时，其数据报文会以 POST 请求的形式打到这个接口。
    """
    ctx_token = current_mcp_token.set(token)
    try:
        return await mcp.handle_sse_message(sse_transport)
    finally:
        current_mcp_token.reset(ctx_token)
