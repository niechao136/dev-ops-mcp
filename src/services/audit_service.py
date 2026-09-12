"""
审计日志服务：统一写入 audit_logs。

身份约定:
- actor_type: 'human'（来自 Web UI/JWT）或 'ai'（来自 MCP/API Key）
- actor_id: 对应 user_id 或 api_token id
"""

from typing import Any, Dict, Optional

from src.dbs.db import get_db_session
from src.dbs.orm import AuditLog


def log_action(
    actor_type: str,
    actor_id: int,
    action_category: str,
    target_project: Optional[str],
    details: Dict[str, Any],
    status: str = "success",
    output_log: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    """写入一条审计日志（不抛出异常，避免审计失败影响主流程）"""
    try:
        with get_db_session() as db:
            db.add(AuditLog(
                actor_type=actor_type,
                actor_id=actor_id,
                action_category=action_category,
                target_project=target_project,
                action_details=details,
                status=status,
                output_log=output_log,
                ip_address=ip_address,
            ))
            db.commit()
    except Exception:
        # 审计写入失败不应阻断业务操作
        pass


def log_ai_action(
    action_category: str,
    target_project: Optional[str],
    details: Dict[str, Any],
    status: str = "success",
) -> None:
    """以当前 MCP 调用者（API Key）身份写入审计日志；无身份时忽略"""
    from src.utils.context import check_token

    token = check_token()[0]
    if not token:
        return
    log_action("ai", token.id, action_category, target_project, details, status)
