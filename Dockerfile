# ---------- Stage 1: 构建依赖 ----------
FROM python:3.11-slim-bookworm AS builder

# 镜像源参数：默认官方源（海外服务器可直接构建），
# 国内服务器在 .env 中配置 UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple 提速
# （compose 层已有官方默认值，这里同步一份防止单独 docker build 时为空）
ARG UV_INDEX_URL=https://pypi.org/simple

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

# 通过 PyPI 安装 uv：原先从 ghcr.io/astral-sh/uv 拷贝镜像文件，
# 但构建机访问 ghcr.io 匿名拉取会被拒（failed to fetch oauth token: denied）
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -i "${UV_INDEX_URL}" "uv>=0.8,<1"

# RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
#     --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
#     apt-get update && apt-get install -y --no-install-recommends \
#     gcc g++ make python3-dev

WORKDIR /app
# 复制 uv.lock 锁定依赖版本；当 UV_INDEX_URL 与 lock 中记录的源不一致时，
# uv 会自动按指定源重新解析（海外走官方源、国内走镜像源均可构建）
COPY pyproject.toml uv.lock ./

# 由 uv 按上述索引源安装依赖
ENV UV_INDEX_URL=${UV_INDEX_URL}
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --no-install-project

COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# ---------- Stage 2: 精简运行时镜像 ----------
FROM python:3.11-slim-bookworm

# apt 镜像源：默认官方源，国内服务器在 .env 中配置 APT_MIRROR=mirrors.aliyun.com/debian 提速
ARG APT_MIRROR=""

# 只在这里装运行时真正需要的东西
# 如果没有 git+ssh 依赖,openssh-client 可以不装
RUN if [ -n "${APT_MIRROR}" ]; then \
        sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    fi \
    && apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src ./src

CMD ["sh", "-c", "python -m src.dbs.migrate && uvicorn src.main:app --host 0.0.0.0 --port 8000"]