import os
import sys
from contextlib import contextmanager
from dotenv import load_dotenv
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.utils.path import ROOT_DIR
from src.utils.security import encrypt_api_key, generate_api_key, pwd_context

from .orm import ApiToken, Base, User


if sys.platform == 'win32':
    try:
        os.system('chcp 65001')
    except:
        pass

load_dotenv()


DATA_DIR = Path(ROOT_DIR) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_FILE_PATH = DATA_DIR / "devops.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE_PATH}"


engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


admin_usr = os.getenv("ADMIN_USERNAME", "admin")
admin_pwd = os.getenv("ADMIN_PASSWORD", "admin@123")
default_api_key = os.getenv("DEFAULT_API_KEY", "default")


def init_db():
    Base.metadata.create_all(bind=engine)

    with get_db_session() as db:
        admin_user = db.query(User).filter(User.username == admin_usr).first()

        if not admin_user:
            print("[DB Init] 未检测到管理员账号，正在创建初始超级管理员...")

            admin_user = User(
                username=admin_usr,
                password_hash=pwd_context.hash(admin_pwd),
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.flush()

            print(f"[DB Init] 初始管理员创建成功！")
            print(f"账号: {admin_usr}")
            print(f"密码: {admin_pwd}")
        else:
            print("[DB Init] 管理员账号已存在，跳过账号创建。")

        default_token_exists = db.query(ApiToken).filter(ApiToken.token_name == default_api_key).first()

        if not default_token_exists:
            print("[DB Init] 未检测到默认 MCP 密钥，正在生成默认 MCP 密钥...")

            plain_key, key_hash, prefix = generate_api_key()
            key_encrypted = encrypt_api_key(plain_key)
            admin_id = admin_user.id
            assert isinstance(admin_id, int)

            default_token = ApiToken(
                token_name=default_api_key,
                encrypted_token=key_encrypted,
                token_hash=key_hash,
                token_prefix=prefix,
                allowed_projects=None,  # None 代表拥有全部项目操作权限
                is_active=True,
                created_by=admin_id # 绑定给刚刚创建或已存在的 admin 用户
            )
            db.add(default_token)
            db.commit()

            print(f"[DB Init] 默认 MCP API Key 生成成功！")
            print(f"密钥明文: {plain_key}")
        else:
            db.commit()  # 确保之前的操作正常结束
            print("[DB Init] 默认 MCP 密钥已存在，跳过密钥创建。")
