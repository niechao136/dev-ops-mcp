from fastapi import APIRouter, Depends
from typing import Optional, Annotated
from sqlalchemy import asc, desc, or_
import json

from src.db.db import get_db_session
from src.db.orm import AuditLog, User, ApiToken
from src.schema.api import DataResult, PageResult
from src.schema.audit_log import (
    AuditLogInfo, 
    AuditLogPageParams,
    AuditLogDelete
)
from src.util.auth import get_current_user, get_current_admin


audit_log_router = APIRouter(
    prefix="/audit_log",
    tags=["操作日志"]
)


@audit_log_router.get(
    path="",
    response_model=PageResult[AuditLogInfo],
    summary="获取操作日志列表",
    description="分页获取操作日志，支持筛选和搜索"
)
async def get_audit_logs(
    params: Annotated[AuditLogPageParams, Depends()],
    _ = Depends(get_current_user)
):
    with get_db_session() as db:
        query = db.query(AuditLog)

        # 筛选条件
        if params.keyword:
            search = f"%{params.keyword}%"
            query = query.filter(
                or_(
                    AuditLog.action_category.ilike(search),
                    AuditLog.target_project.ilike(search) if AuditLog.target_project else False
                )
            )
        
        if params.actor_type:
            # 前端传的是 'user' 或 'api_key'，但数据库存的是 'human' 或 'ai'
            db_actor_type = "human" if params.actor_type == "user" else "ai" if params.actor_type == "api_key" else params.actor_type
            query = query.filter(AuditLog.actor_type == db_actor_type)
        
        if params.action_category:
            query = query.filter(AuditLog.action_category == params.action_category)
        
        if params.status:
            query = query.filter(AuditLog.status == params.status)
        
        if params.target_project:
            query = query.filter(AuditLog.target_project == params.target_project)

        total = query.count()

        # 排序
        if params.order_by:
            order_column = getattr(AuditLog, params.order_by)
            if params.direction == "asc":
                query = query.order_by(asc(order_column))
            else:
                query = query.order_by(desc(order_column))

        # 分页
        records = query.offset((params.page - 1) * params.size).limit(params.size).all()

        # 获取操作者名称
        result_items = []
        for record in records:
            actor_name = None
            # 数据库中存的是 'human' 或 'ai'，但前端期望的是 'user' 或 'api_key'
            api_actor_type = "user" if record.actor_type == "human" else "api_key" if record.actor_type == "ai" else record.actor_type
            
            if record.actor_type == "human":
                user = db.query(User).filter(User.id == record.actor_id).first()
                if user:
                    actor_name = user.username
            elif record.actor_type == "ai":
                token = db.query(ApiToken).filter(ApiToken.id == record.actor_id).first()
                if token:
                    actor_name = token.token_name
            
            result_items.append(AuditLogInfo(
                id=record.id,
                actor_type=api_actor_type,
                actor_id=record.actor_id,
                actor_name=actor_name,
                action_category=record.action_category,
                target_project=record.target_project,
                action_details=record.action_details,
                status=record.status,
                output_log=record.output_log,
                ip_address=record.ip_address,
                created_at=record.created_at
            ))

        return PageResult(
            total=total,
            data=result_items,
            page=params.page,
            size=params.size
        )


@audit_log_router.get(
    path="/{log_id}",
    response_model=DataResult[AuditLogInfo],
    summary="获取操作日志详情",
    description="根据日志ID获取详细信息"
)
async def get_audit_log_detail(
    log_id: int,
    _ = Depends(get_current_user)
):
    with get_db_session() as db:
        record = db.query(AuditLog).filter(AuditLog.id == log_id).first()
        
        if not record:
            return DataResult(status=0, msg="日志不存在")
        
        actor_name = None
        # 数据库中存的是 'human' 或 'ai'，但前端期望的是 'user' 或 'api_key'
        api_actor_type = "user" if record.actor_type == "human" else "api_key" if record.actor_type == "ai" else record.actor_type
        
        if record.actor_type == "human":
            user = db.query(User).filter(User.id == record.actor_id).first()
            if user:
                actor_name = user.username
        elif record.actor_type == "ai":
            token = db.query(ApiToken).filter(ApiToken.id == record.actor_id).first()
            if token:
                actor_name = token.token_name
        
        return DataResult(
            status=1,
            data=AuditLogInfo(
                id=record.id,
                actor_type=api_actor_type,
                actor_id=record.actor_id,
                actor_name=actor_name,
                action_category=record.action_category,
                target_project=record.target_project,
                action_details=record.action_details,
                status=record.status,
                output_log=record.output_log,
                ip_address=record.ip_address,
                created_at=record.created_at
            )
        )


@audit_log_router.get(
    path="/categories/list",
    response_model=DataResult[list[str]],
    summary="获取操作分类列表",
    description="获取所有可用的操作分类"
)
async def get_action_categories(
    _ = Depends(get_current_user)
):
    with get_db_session() as db:
        categories = db.query(AuditLog.action_category).distinct().all()
        category_list = [c[0] for c in categories if c[0]]
        return DataResult(status=1, data=category_list)


@audit_log_router.get(
    path="/projects/list",
    response_model=DataResult[list[str]],
    summary="获取项目列表",
    description="获取日志中涉及的所有项目"
)
async def get_target_projects(
    _ = Depends(get_current_user)
):
    with get_db_session() as db:
        projects = db.query(AuditLog.target_project).distinct().all()
        project_list = [p[0] for p in projects if p[0]]
        return DataResult(status=1, data=project_list)


@audit_log_router.delete(
    path="",
    response_model=DataResult[bool],
    summary="删除操作日志",
    description="批量删除操作日志"
)
async def delete_audit_logs(
    payload: AuditLogDelete,
    _ = Depends(get_current_admin)
):
    with get_db_session() as db:
        deleted_count = db.query(AuditLog).filter(
            AuditLog.id.in_(payload.ids)
        ).delete(synchronize_session=False)
        db.commit()
        return DataResult(status=1, data=True)


@audit_log_router.get(
    path="/count",
    response_model=DataResult[int],
    summary="获取操作日志总数",
    description="获取操作日志总数"
)
async def get_audit_logs_count(
    _ = Depends(get_current_user)
):
    with get_db_session() as db:
        count = db.query(AuditLog).count()
        return DataResult(status=1, data=count)
