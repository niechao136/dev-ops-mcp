import asyncio
from typing import Optional
from fastapi import FastAPI, Request, Depends, HTTPException, Header
from contextlib import asynccontextmanager

# 引入官方的 MCP Server 库和 SSE 传输层
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import TextContent

# =====================================================================
# 1. 安全配置层
# =====================================================================
# 生产环境中请使用环境变量 os.getenv("MCP_TOKEN")
API_TOKEN = "sk-super-secret-devops-token"


async def verify_token(authorization: Optional[str] = Header(None)):
    """简单的 Bearer Token 拦截器，保护你的节点不被非法调用"""
    if not authorization or authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid Node Token")


# =====================================================================
# 2. 初始化 MCP Server
# =====================================================================
# 名字可以根据机器节点动态配置，比如 devops-node-frontend-01
mcp = Server("devops-remote-node-01")


# =====================================================================
# 3. 核心：注册项目操作的 Tools
# 大模型会自动读取函数的 docstring 和参数类型提示，生成给 AI 的工具说明书
# =====================================================================
@mcp.tool()
async def operate_project(project_name: str, action: str, force: bool = False) -> list[TextContent]:
    """
    执行目标服务器上的项目进程操作 (例如重启容器、重启服务)。

    参数:
        project_name: 项目名称 (例如: 'web-frontend', 'backend-api')
        action: 执行的动作，必须是 'start', 'stop', 'restart', 'status' 之一
        force: 是否强制执行 (仅针对 stop/restart 有效)
    """
    # 1. 严格的安全白名单校验，防止注入攻击
    allowed_actions = ["start", "stop", "restart", "status"]
    if action not in allowed_actions:
        return [TextContent(type="text", text=f"❌ 错误: 不支持的操作 '{action}'。允许的操作: {allowed_actions}")]

    # 2. 模拟真实的运维逻辑 (这里你可以换成 subprocess.run 执行 docker 命令)
    # import subprocess
    # cmd = ["docker", action, project_name]
    # result = subprocess.run(cmd, capture_output=True, text=True)

    # 模拟返回
    force_msg = " (强制)" if force else ""
    return [
        TextContent(type="text", text=f"✅ 成功: 在节点执行了 '{action}' 操作，目标项目 '{project_name}'{force_msg}。")]


@mcp.tool()
async def read_project_logs(project_name: str, lines: int = 100) -> list[TextContent]:
    """
    读取指定项目的最新运行日志，用于排错分析。
    """
    # 模拟读取日志文件或 docker logs
    mock_log = f"[2026-05-21 17:00:00] INFO {project_name} - Service started successfully.\n" \
               f"[2026-05-21 17:05:12] WARN {project_name} - High memory usage detected."

    return [TextContent(type="text", text=f"项目 {project_name} 的最新 {lines} 行日志:\n{mock_log}")]


# =====================================================================
# 4. 挂载 FastAPI 与 SSE 传输路由
# =====================================================================
app = FastAPI(title="DevOps Node MCP Server")

# 全局存储 SSE Transport 实例（单节点简易版）
# 如果你的节点并发极高，建议使用全局字典按 session_id 管理 transport
global_transport: Optional[SseServerTransport] = None


@app.get("/sse")
async def sse_endpoint(request: Request, _: None = Depends(verify_token)):
    """
    第一步：大模型（Client）请求此接口建立 SSE 持久化流式连接
    """
    global global_transport
    # 初始化 SSE 传输层，必须告知它 POST 消息该发往哪个 URI
    global_transport = SseServerTransport("/messages")

    # 在后台任务中启动 MCP Server 的事件循环
    asyncio.create_task(mcp.connect(global_transport))

    # 将 FastAPI 的 Request 委托给 MCP 的 SSE 处理器
    return await global_transport.handle_sse(request)


@app.post("/messages")
async def messages_endpoint(request: Request, _: None = Depends(verify_token)):
    """
    第二步：建立连接后，大模型会通过此接口发送 JSON-RPC 格式的 Tool 调用指令
    """
    global global_transport
    if global_transport is None:
        raise HTTPException(status_code=400, detail="SSE Connection not initialized")

    # 将收到的 HTTP POST 消息转交给底层的 MCP Transport 进行解析和处理
    await global_transport.handle_post_message(request.scope, request.receive, request._send)
    return {}


if __name__ == "__main__":
    import uvicorn

    # 启动命令: python node_mcp_server.py
    uvicorn.run(app, host="0.0.0.0", port=8080)