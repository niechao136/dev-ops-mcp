# 阶段 1: 构建
FROM node:20-alpine AS builder

# 镜像源参数：默认官方源，国内服务器在 .env 中配置：
#   NPM_REGISTRY=https://registry.npmmirror.com
#   ALPINE_MIRROR=mirrors.aliyun.com
ARG NPM_REGISTRY=https://registry.npmjs.org
ARG ALPINE_MIRROR=""

WORKDIR /app

# 部分原生依赖(如 sharp)在 alpine 上需要这个兼容库
# 配置了 ALPINE_MIRROR 时将 Alpine CDN 替换为国内镜像
RUN if [ -n "${ALPINE_MIRROR}" ]; then \
      sed -i "s|dl-cdn.alpinelinux.org|${ALPINE_MIRROR}|g" /etc/apk/repositories; \
    fi \
  && apk add --no-cache libc6-compat

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
  npm ci --registry="${NPM_REGISTRY}"

ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

# 注意：此时 next.config.js 中不要有 output: 'export'
RUN --mount=type=cache,target=/app/.next/cache \
  npm run build

# 阶段 2: 运行
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production \
  NEXT_TELEMETRY_DISABLED=1

# 非 root 用户运行，更安全
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# standalone 模式下只需要这三样，不再需要完整 node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# 注意：启动方式变了，不再用 npm start
CMD ["node", "server.js"]
