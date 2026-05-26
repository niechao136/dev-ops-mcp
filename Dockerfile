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
    && rm -rf /var/lib/apt/lists/*

# 4. 直接安装 uv (它会自动装到 /usr/local/bin)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

WORKDIR /app

# 5. 复制依赖文件
COPY requirements.txt ./

# 6. 安装依赖 (创建虚拟环境)
# --system 参数可以让 uv 直接把包装在容器的 Python 环境里，
# 这样就不需要额外的虚拟环境层，容器更轻量
RUN uv pip install --system --no-cache -r requirements.txt

# 7. 复制源码
COPY src ./src
COPY .env ./

# 8. 启动命令
# 既然用了 --system，直接调用 uvicorn 即可
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]