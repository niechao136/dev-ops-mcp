import os
import asyncio
import paramiko
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
        self.client = None
        self.channel = None
        self.active = False

    async def connect(self, work_dir: str = "/") -> bool:
        try:
            logger.info("初始化SSH客户端...")
            logger.info(f"连接信息: {SSH_USER}@{SSH_HOST}:{SSH_PORT}, key={SSH_KEY}")
            
            self.client = paramiko.SSHClient()
            self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            private_key = self._load_private_key()
            if not private_key:
                raise Exception("无法加载私钥文件")
            
            logger.info("连接SSH服务器...")
            self.client.connect(
                hostname=SSH_HOST,
                port=SSH_PORT,
                username=SSH_USER,
                pkey=private_key,
                timeout=10,
                banner_timeout=10,
                auth_timeout=10
            )
            logger.info("SSH连接成功")
            
            logger.info("创建shell会话...")
            self.channel = self.client.invoke_shell(term='xterm', width=80, height=24)
            self.channel.setblocking(0)
            
            if work_dir and work_dir != "/":
                logger.info(f"切换工作目录: {work_dir}")
                self.channel.send(f"cd {work_dir}\n".encode('utf-8'))
            
            self.active = True
            logger.info("SSH连接完成")
            return True
        except Exception as e:
            logger.error(f"SSH连接失败: {e}")
            import traceback
            logger.error(f"堆栈信息:\n{traceback.format_exc()}")
            self.close()
            return False

    def _load_private_key(self):
        key_types = [
            paramiko.RSAKey,
            paramiko.Ed25519Key,
            paramiko.ECDSAKey,
        ]
        
        for key_class in key_types:
            try:
                key = key_class.from_private_key_file(SSH_KEY)
                logger.info(f"成功加载密钥，类型: {key_class.__name__}")
                return key
            except Exception as e:
                logger.info(f"尝试 {key_class.__name__} 失败: {e}")
                continue
        
        try:
            with open(SSH_KEY, 'r') as f:
                key_content = f.read()
            
            for key_class in key_types:
                try:
                    key = key_class.from_private_key(key_content)
                    logger.info(f"成功从内容加载密钥，类型: {key_class.__name__}")
                    return key
                except Exception as e:
                    logger.info(f"尝试从内容加载 {key_class.__name__} 失败: {e}")
                    continue
        except Exception as e:
            logger.error(f"读取密钥文件失败: {e}")
        
        return None

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
                logger.info(f"调整终端大小: {width}x{height}")
                return True
            except Exception as e:
                logger.error(f"调整终端大小失败: {e}")
        return False

    def close(self):
        self.active = False
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
        return self.active and self.channel is not None and self.channel.active
