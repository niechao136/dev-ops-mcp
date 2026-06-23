# 1. 使用 Python 镜像
FROM python:3.11-slim-bookworm

# 2. 设置环境变量，强制 uv 安装到固定位置
ENV UV_INSTALL_DIR="/usr/local/bin"
ENV PATH="/usr/local/bin:${PATH}"
# Python 环境变量优化
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. 安装必要工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# 4. 直接安装 uv (它会自动装到 /usr/local/bin)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

WORKDIR /app

# 5. 复制依赖文件和源码
COPY pyproject.toml uv.lock ./
COPY src ./src

# 6. 安装依赖
# --frozen 使用锁文件安装，确保版本一致
RUN uv sync --frozen

# 7. 启动命令：先执行数据库迁移，再启动服务
CMD ["sh", "-c", "python -m src.db.migrate && uvicorn src.main:app --host 0.0.0.0 --port 8000"]