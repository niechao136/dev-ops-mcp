from fastapi import APIRouter, Depends, Request, Response
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.types import Receive, Scope, Send
from urllib.parse import parse_qs

from src.db.db import get_db_session
from src.db.orm import ApiToken
from src.tool.mcp import mcp
from src.util.auth import get_api_key
from src.util.context import current_mcp_token
from src.util.security import verify_api_key


mcp_app = mcp.http_app(path="/mcp")
