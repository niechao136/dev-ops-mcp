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

