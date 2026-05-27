import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.routing import Route


from src.api.api_key import api_key_router
from src.api.auth import auth_router
from src.api.mcp import mcp_router, handle_mcp_messages_raw
from src.db.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):

    init_db()

    yield


app = FastAPI(root_path="/api", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware, # type: ignore
    allow_origins=["*"],  # 允许访问的域名列表，["*"] 表示允许所有
    allow_credentials=True,  # 是否允许携带 cookie
    allow_methods=["*"],      # 允许的方法，例如 ["GET", "POST"]
    allow_headers=["*"],      # 允许的请求头
)


app.include_router(router=api_key_router)
app.include_router(router=auth_router)
app.include_router(router=mcp_router)
app.router.routes.insert(0, Route("/api/mcp/messages", handle_mcp_messages_raw, methods=["POST"]))


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=10096, reload=True)
