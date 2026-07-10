import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status, Depends
from fastapi.security import HTTPBearer
from typing import Annotated, Optional
import logging

from src.dbs.db import get_db_session
from src.dbs.orm import Project
from src.utils.auth import get_current_user
from src.utils.jwt import verify_access_token
from src.utils.ssh_client import SSHClient

logger = logging.getLogger(__name__)

terminal_router = APIRouter(
    prefix="/projects",
    tags=["终端"]
)


async def verify_ws_token(token: str):
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalid or expired"
        )
    return payload


@terminal_router.websocket("/{project_id}/terminal")
async def terminal_websocket(
    websocket: WebSocket,
    project_id: int,
    token: Optional[str] = None
):
    if not token:
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        await websocket.close(code=1008, reason="Unauthorized: No token provided")
        return

    try:
        payload = verify_access_token(token)
        if not payload:
            await websocket.close(code=1008, reason="Unauthorized: Invalid token")
            return
    except Exception as e:
        await websocket.close(code=1008, reason=f"Unauthorized: {str(e)}")
        return

    with get_db_session() as db:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            await websocket.close(code=1008, reason="Project not found")
            return

    ssh_client = SSHClient()
    work_dir = project.work_dir or "/"

    try:
        connected = await ssh_client.connect(work_dir)
        if not connected:
            await websocket.close(code=1011, reason="Failed to connect to SSH server")
            return

        await websocket.accept()

        async def ssh_reader():
            while ssh_client.is_active:
                try:
                    data = ssh_client.recv(4096)
                    if data:
                        await websocket.send_text(data)
                    else:
                        await asyncio.sleep(0.05)
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.error(f"SSH读取错误: {e}")
                    break

        async def ws_reader():
            while True:
                try:
                    data = await websocket.receive_text()
                    if data.startswith("\x00resize:"):
                        parts = data.split(":")
                        if len(parts) == 3:
                            width = int(parts[1])
                            height = int(parts[2])
                            ssh_client.resize_pty(width, height)
                    else:
                        ssh_client.send(data)
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.error(f"WebSocket读取错误: {e}")
                    break

        await asyncio.gather(ssh_reader(), ws_reader())

    except WebSocketDisconnect:
        logger.info("WebSocket连接断开")
    except Exception as e:
        logger.error(f"终端连接异常: {e}")
    finally:
        ssh_client.close()
        logger.info("SSH连接已关闭")