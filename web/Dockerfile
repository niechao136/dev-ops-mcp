# 阶段 1: 构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
# 注意：此时 next.config.js 中不要有 output: 'export'
RUN --mount=type=cache,target=/app/.next/cache \
  npm run build

# 阶段 2: 运行
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# standalone 模式下只需要这三样，不再需要完整 node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
# 注意：启动方式变了，不再用 npm start
CMD ["node", "server.js"]
