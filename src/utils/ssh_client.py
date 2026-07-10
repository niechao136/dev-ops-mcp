import os
import asyncio
from dotenv import load_dotenv
from typing import Optional
import logging

load_dotenv()

SSH_HOST = os.environ.get("HOST_SSH", "host.docker.internal")
SSH_PORT = int(os.environ.get("HOST_SSH_PORT", "22"))
SSH_USER = os.environ.get("HOST_SSH_USER", "devops")
SSH_KEY = os.environ.get("HOST_SSH_KEY", "/root/.ssh/id_rsa")

logger = logging.getLogger(__name__)


class SSHClient:
    def __init__(self):
        self.process = None
        self.stdin = None
        self.stdout = None
        self.stderr = None
        self.active = False

    async def connect(self, work_dir: str = "/") -> bool:
        try:
            logger.info("初始化SSH客户端...")
            
            ssh_cmd = (
                f"ssh -i {SSH_KEY} "
                f"-o StrictHostKeyChecking=no "
                f"-o ConnectTimeout=10 "
                f"-p {SSH_PORT} "
                f"{SSH_USER}@{SSH_HOST} "
                f"'cd {work_dir} && exec /bin/bash -i'"
            )
            
            logger.info(f"执行SSH命令: {ssh_cmd}")
            
            self.process = await asyncio.create_subprocess_shell(
                ssh_cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                preexec_fn=os.setsid if os.name != 'nt' else None
            )
            
            self.stdin = self.process.stdin
            self.stdout = self.process.stdout
            self.stderr = self.process.stderr
            self.active = True
            
            logger.info("SSH进程创建成功")
            return True
        except Exception as e:
            logger.error(f"SSH连接失败: {e}")
            import traceback
            logger.error(f"堆栈信息:\n{traceback.format_exc()}")
            self.close()
            return False

    def send(self, data: str) -> bool:
        if self.stdin and self.active:
            try:
                self.stdin.write(data.encode('utf-8'))
                asyncio.create_task(self.stdin.drain())
                return True
            except Exception as e:
                logger.error(f"发送数据失败: {e}")
                return False
        return False

    async def recv(self, buffer_size: int = 4096) -> Optional[str]:
        if self.stdout and self.active:
            try:
                data = await asyncio.wait_for(
                    self.stdout.read(buffer_size),
                    timeout=0.1
                )
                if data:
                    return data.decode('utf-8', errors='replace')
            except asyncio.TimeoutError:
                pass
            except Exception as e:
                logger.error(f"接收数据失败: {e}")
        return None

    def resize_pty(self, width: int, height: int) -> bool:
        logger.info(f"调整终端大小: {width}x{height}")
        return False

    def close(self):
        self.active = False
        if self.process:
            try:
                if os.name != 'nt':
                    os.killpg(os.getpgid(self.process.pid), 9)
                else:
                    self.process.kill()
            except Exception:
                pass
            self.process = None
        self.stdin = None
        self.stdout = None
        self.stderr = None

    @property
    def is_active(self) -> bool:
        return self.active and self.process is not None and self.process.returncode is None
