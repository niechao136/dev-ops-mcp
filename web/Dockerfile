# 阶段 1: 构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
# 注意：此时 next.config.js 中不要有 output: 'export'
RUN npm run build

# 阶段 2: 运行
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# 只复制必要文件以减小镜像体积
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000
# 使用 next start 运行 Node.js 服务
CMD ["npm", "start"]
