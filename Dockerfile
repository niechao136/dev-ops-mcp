# ---------- Stage 1: 构建依赖 ----------
FROM python:3.11-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

# 通过 PyPI 安装 uv：原先从 ghcr.io/astral-sh/uv 拷贝镜像文件，
# 但构建机访问 ghcr.io 匿名拉取会被拒（failed to fetch oauth token: denied）
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install "uv>=0.8,<1"

# RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
#     --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
#     apt-get update && apt-get install -y --no-install-recommends \
#     gcc g++ make python3-dev

WORKDIR /app
COPY pyproject.toml ./
# 构建服务器在海外(新加坡)，不复制 uv.lock(其记录的清华源海外访问超时)，
# 改用官方 PyPI 源，由 uv 现场解析依赖
ENV UV_INDEX_URL=https://pypi.org/simple
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --no-install-project

COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# ---------- Stage 2: 精简运行时镜像 ----------
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# 只在这里装运行时真正需要的东西
# 如果没有 git+ssh 依赖,openssh-client 可以不装
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src ./src

CMD ["sh", "-c", "python -m src.dbs.migrate && uvicorn src.main:app --host 0.0.0.0 --port 8000"]