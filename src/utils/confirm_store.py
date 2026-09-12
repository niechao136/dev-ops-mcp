"""
高危管理操作的两段式确认（propose -> confirm）令牌存储。

设计说明:
- 写工具在检测到高危变更（delete、或写入 shell_command / condition_script）时，
  第一次调用只返回"变更预览 + confirm_token"，不落库；
- LLM 须向用户复述风险并征得同意后，携带 confirm_token 二次调用才真正执行；
- confirm_token 为一次性、短时效（默认 5 分钟），且与操作类型绑定，防止跨操作复用；
- 存储在进程内存中，服务重启后自动失效（预览本身不产生副作用，可重新发起）。
"""

import secrets
import time
from typing import Any, Dict, Optional

TTL_SECONDS = 300  # 确认令牌有效期 5 分钟

# key: confirm_token, value: {"action": ..., "preview": ..., "expires_at": ...}
_PENDING: Dict[str, Dict[str, Any]] = {}


def create_confirm(action: str, preview: Dict[str, Any]) -> str:
    """为一次高危操作生成确认令牌，并暂存变更预览"""
    # 顺带清理过期令牌
    now = time.time()
    for key in [k for k, v in _PENDING.items() if v["expires_at"] < now]:
        _PENDING.pop(key, None)

    token_str = secrets.token_hex(16)
    _PENDING[token_str] = {
        "action": action,
        "preview": preview,
        "expires_at": now + TTL_SECONDS,
    }
    return token_str


def consume_confirm(token_str: str, action: str) -> Optional[Dict[str, Any]]:
    """
    消费确认令牌（一次性）。校验:
    - 令牌存在且未过期
    - 操作类型与生成时一致（防止拿 A 操作的令牌确认 B 操作）
    校验通过返回暂存的预览内容，否则返回 None。
    """
    entry = _PENDING.pop(token_str, None)
    if not entry:
        return None
    if entry["expires_at"] < time.time():
        return None
    if entry["action"] != action:
        return None
    return entry["preview"]
