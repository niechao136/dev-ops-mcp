from datetime import datetime, UTC
from typing import List, Optional
from sqlalchemy import String, Boolean, Text, ForeignKey, Integer, DateTime, JSON, LargeBinary
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ==========================================
# 1. 用户表 (人类管理员)
# ==========================================
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="admin") # admin, user
    email: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(UTC))

    # 关联：该用户签发了哪些 API Token
    tokens: Mapped[List["ApiToken"]] = relationship(back_populates="creator")


# ==========================================
# 2. 密钥表 (提供给大模型/MCP使用的 Token)
# ==========================================
class ApiToken(Base):
    __tablename__ = "api_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_name: Mapped[str] = mapped_column(String(100))  # 如："生产环境大模型读写Token"
    encrypted_token: Mapped[bytes] = mapped_column(LargeBinary)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    token_prefix: Mapped[Optional[str]] = mapped_column(String(20))
    allowed_projects: Mapped[Optional[str]] = mapped_column(Text)  # JSON数组字符串，空代表全部权限
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # 外键：是谁在 Web 界面上创建了这个 Token
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    creator: Mapped["User"] = relationship(back_populates="tokens")


# ==========================================
# 3. 项目表 (被管理的物理项目)
# ==========================================
class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    work_dir: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # 关联：这个项目下有哪些指令
    commands: Mapped[List["Command"]] = relationship(back_populates="project", cascade="all, delete-orphan")


# ==========================================
# 4. 指令表 (项目对应的真实操作脚本)
# ==========================================
class Command(Base):
    __tablename__ = "commands"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    action_type: Mapped[str] = mapped_column(String(50)) # start, stop, restart, logs
    description: Mapped[Optional[str]] = mapped_column(Text)
    shell_command: Mapped[str] = mapped_column(Text) # 真实的 Linux 脚本
    timeout: Mapped[int] = mapped_column(Integer, default=60) # 超时时间(秒)

    project: Mapped["Project"] = relationship(back_populates="commands")


# ==========================================
# 5. 操作审计日志表 (Audit Log)
# ==========================================
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)

    # 身份溯源：区分是 人类 还是 AI
    actor_type: Mapped[str] = mapped_column(String(20), index=True)  # 'human' 或 'ai'
    actor_id: Mapped[int] = mapped_column(Integer, index=True)  # 存 user_id 或 token_id

    # 动作定性
    action_category: Mapped[str] = mapped_column(String(50), index=True)
    target_project: Mapped[Optional[str]] = mapped_column(String(100))

    # 核心：存放当时执行的真实命令或修改前后的参数（JSON 格式便于后续检索和分析）
    action_details: Mapped[dict] = mapped_column(JSON)

    # 执行结果
    status: Mapped[str] = mapped_column(String(20))  # success, failed, timeout
    output_log: Mapped[Optional[str]] = mapped_column(Text)  # 终端的回显结果

    # 环境信息
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(UTC), index=True)
