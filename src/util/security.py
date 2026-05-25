import base64
import hashlib
import os
import secrets
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from passlib.context import CryptContext


load_dotenv()


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_api_key() -> tuple[str, str, str]:
    """返回 (明文密钥, 哈希值, 前缀)"""
    plain_key = secrets.token_hex(32)           # 64字符 hex
    key_hash = pwd_context.hash(plain_key)
    prefix = plain_key[:8]
    return plain_key, key_hash, prefix


def verify_api_key(plain_key: str, key_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_key, key_hash)
    except Exception:
        return False


def get_fernet_cipher():
    raw_key = os.getenv("API_KEY_SECRET")
    if not raw_key:
        raise RuntimeError("API_KEY_SECRET 环境变量未设置")

    key_hash = hashlib.sha256(raw_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_hash)
    return Fernet(fernet_key)


cipher = get_fernet_cipher()


def encrypt_api_key(plain_key: str) -> bytes:
    """加密明文密钥，返回二进制数据"""
    return cipher.encrypt(plain_key.encode())


def decrypt_api_key(encrypted: bytes) -> str:
    """解密二进制数据，返回明文密钥"""
    return cipher.decrypt(encrypted).decode()
