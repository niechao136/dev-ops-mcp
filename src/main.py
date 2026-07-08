import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp.utilities.lifespan import combine_lifespans
from sqlalchemy import text


from src.apis.api_key import api_key_router
from src.apis.auth import auth_router
from src.apis.user import user_router
from src.apis.project import project_router
from src.apis.audit_log import audit_log_router
from src.apis.dashboard import dashboard_router
from src.apis.public_command import public_command_router
from src.apis.task import task_router
from src.dbs.db import init_db
from src.middlewares.mcp_auth import MCPAuthMiddleware
from src.tools.mcp import mcp_app


@asynccontextmanager
async def lifespan(_: FastAPI):

    init_db()

    yield


app = FastAPI(root_path="/api", lifespan=combine_lifespans(lifespan, mcp_app.lifespan))


app.add_middleware(
    CORSMiddleware, # type: ignore
    allow_origins=["*"],  # 允许访问的域名列表，["*"] 表示允许所有
    allow_credentials=True,  # 是否允许携带 cookie
    allow_methods=["*"],      # 允许的方法，例如 ["GET", "POST"]
    allow_headers=["*"],      # 允许的请求头
)


app.add_middleware(MCPAuthMiddleware)


app.include_router(router=api_key_router)
app.include_router(router=auth_router)
app.include_router(router=user_router)
app.include_router(router=project_router)
app.include_router(router=audit_log_router)
app.include_router(router=dashboard_router)
app.include_router(router=public_command_router)
app.include_router(router=task_router)
app.mount("/mcp", mcp_app)  # 将 MCP 应用挂载到 /mcp 路径下


@app.get("/health", summary="服务健康检查")
async def health_check():
    try:
        from src.dbs.db import get_db_session
        with get_db_session() as db:
            db.execute(text("SELECT 1"))
        
        return {
            "status": "healthy",
            "service": "devops-mcp",
            "version": "1.0.0",
            "timestamp": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "devops-mcp",
            "error": str(e),
            "timestamp": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
        }


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=10097, reload=True)
