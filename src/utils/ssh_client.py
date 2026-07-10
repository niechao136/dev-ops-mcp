import os
import paramiko
from dotenv import load_dotenv
from typing import Optional, Callable
import logging

load_dotenv()

SSH_HOST = os.environ.get("HOST_SSH", "host.docker.internal")
SSH_PORT = int(os.environ.get("HOST_SSH_PORT", "22"))
SSH_USER = os.environ.get("HOST_SSH_USER", "devops")
SSH_KEY = os.environ.get("HOST_SSH_KEY", "/root/.ssh/id_rsa")

logger = logging.getLogger(__name__)


class SSHClient:
    def __init__(self):
        self.client = None
        self.channel = None
        self.sftp = None

    async def connect(self, work_dir: str = "/") -> bool:
        try:
            self.client = paramiko.SSHClient()
            self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            from paramiko import RSAKey, Ed25519Key, ECDSAKey
            private_key = None
            
            for key_class in [RSAKey, Ed25519Key, ECDSAKey]:
                try:
                    private_key = key_class.from_private_key_file(SSH_KEY)
                    logger.info(f"成功加载密钥，类型: {key_class.__name__}")
                    break
                except Exception:
                    continue
            
            if not private_key:
                raise Exception("无法加载私钥文件，不支持的密钥格式")
            
            self.client.connect(
                hostname=SSH_HOST,
                port=SSH_PORT,
                username=SSH_USER,
                pkey=private_key,
                timeout=10,
                banner_timeout=10,
                auth_timeout=10
            )
            
            self.channel = self.client.invoke_shell()
            self.channel.get_pty(width=80, height=24)
            self.channel.setblocking(0)
            
            if work_dir and work_dir != "/":
                self.channel.send(f"cd {work_dir}\n".encode('utf-8'))
            
            return True
        except Exception as e:
            logger.error(f"SSH连接失败: {e}")
            self.close()
            return False

    def send(self, data: str) -> bool:
        if self.channel and self.channel.active:
            try:
                self.channel.send(data.encode('utf-8'))
                return True
            except Exception as e:
                logger.error(f"发送数据失败: {e}")
                return False
        return False

    def recv(self, buffer_size: int = 4096) -> Optional[str]:
        if self.channel and self.channel.active:
            try:
                data = self.channel.recv(buffer_size)
                if data:
                    return data.decode('utf-8', errors='replace')
            except Exception as e:
                logger.error(f"接收数据失败: {e}")
        return None

    def resize_pty(self, width: int, height: int) -> bool:
        if self.channel and self.channel.active:
            try:
                self.channel.resize_pty(width=width, height=height)
                return True
            except Exception as e:
                logger.error(f"调整终端大小失败: {e}")
                return False
        return False

    def close(self):
        if self.channel:
            try:
                self.channel.close()
            except Exception:
                pass
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass
        self.channel = None
        self.client = None

    @property
    def is_active(self) -> bool:
        return self.channel is not None and self.channel.active
