import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp.utilities.lifespan import combine_lifespans


from src.api.api_key import api_key_router
from src.api.auth import auth_router
from src.api.user import user_router
from src.db.db import init_db
from src.middleware.mcp_auth import MCPAuthMiddleware
from src.tool.mcp import mcp_app


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
app.mount("/mcp", mcp_app)  # 将 MCP 应用挂载到 /mcp 路径下


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=10097, reload=True)
