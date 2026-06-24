from typing import Optional, Literal, List, TypeVar, Generic
from pydantic import BaseModel, Field


class PageParams(BaseModel):
    # --- 分页 ---
    page: int = Field(1, ge=1, description="当前页码")
    size: int = Field(10, ge=1, le=100, description="每页条数")

    # --- 排序 ---
    order_by: Optional[str] = Field(None, description="排序字段，如 'updated_at'")
    direction: Literal["asc", "desc"] = Field("desc", description="排序方向")

    # --- 搜索 ---
    keyword: Optional[str] = Field(None, description="全文搜索关键词")

    @property
    def offset(self) -> int:
        """计算 SQL 的 OFFSET"""
        return (self.page - 1) * self.size


T = TypeVar("T")


class PageResult(BaseModel, Generic[T]):
    total: int = Field(..., description="总数据数")
    data: List[T] = Field(..., description="当前页的数据列表")
    page: int = Field(..., description="当前页数")
    size: int = Field(..., description="每页数据数量")


class DataResult(BaseModel, Generic[T]):
    data: Optional[T] = Field(default=None, description="某项数据具体信息")
    status: Literal[1, 0] = Field(default=0, description="状态码")
    msg: Optional[str] = Field(default=None, description="错误信息")
