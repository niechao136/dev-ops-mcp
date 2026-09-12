import json
from contextvars import ContextVar
from typing import List, Optional, Tuple

from src.dbs.orm import ApiToken


current_mcp_token: ContextVar[Optional[ApiToken]] = ContextVar("current_mcp_token", default=None)


def check_token() -> Tuple[Optional[ApiToken], bool, List[str]]:
    token = current_mcp_token.get()
    if not token:
        return None, False, []

    is_all_permitted = token.allowed_projects is None
    allowed_list = [] if token.allowed_projects is None else json.loads(token.allowed_projects)

    return token, is_all_permitted, allowed_list


def check_project(project_name: str) -> Tuple[Optional[ApiToken], bool]:
    token, is_all_permitted, allowed_list = check_token()
    return token, is_all_permitted or project_name in allowed_list


# =====================================================================
# Scope 权限模型
# =====================================================================
# 旧密钥（scopes 为 NULL）默认仅具备运维执行权限，保持向后兼容
DEFAULT_SCOPES: List[str] = ["ops:execute"]
VALID_SCOPES = {"ops:execute", "resources:read", "resources:write"}


def get_scopes(token: Optional[ApiToken]) -> List[str]:
    """解析 token 的 scope 列表，NULL/空时回退到默认值"""
    if not token or not token.scopes:
        return list(DEFAULT_SCOPES)
    try:
        parsed = json.loads(token.scopes)
        return parsed if isinstance(parsed, list) else list(DEFAULT_SCOPES)
    except (json.JSONDecodeError, TypeError):
        return list(DEFAULT_SCOPES)


def require_scope(scope: str) -> Optional[str]:
    """
    校验当前 MCP 调用者是否具备指定 scope。
    返回 None 表示通过，否则返回错误提示文本。
    """
    token = current_mcp_token.get()
    if not token:
        return "缺少 API Key"
    if scope not in get_scopes(token):
        return (
            f"权限不足: 当前 API Key '{token.token_name}' 缺少 '{scope}' scope。"
            f"请联系管理员在 Web 控制台为该密钥追加此 scope 后重试。"
        )
    return None

