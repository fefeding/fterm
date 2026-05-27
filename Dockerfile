# 构建阶段
FROM node:22-alpine AS build-stage

WORKDIR /app

# 安装构建工具（node-pty、ssh2 等原生模块需要编译）
RUN apk add --no-cache python3 make g++

# 安装 pnpm
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 先复制依赖文件（利用缓存）
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# 安装全部依赖（包括 devDependencies，构建需要）
RUN pnpm install --frozen-lockfile

# 复制源码并构建
COPY . .
RUN pnpm run build

# ============================================
# 生产阶段
# ============================================
FROM node:22-alpine AS production-stage

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 复制构建产物和运行时文件
COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/node_modules ./node_modules
COPY --from=build-stage /app/package.json ./package.json
COPY --from=build-stage /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build-stage /app/patches ./patches
COPY --from=build-stage /app/server.js ./server.js
COPY --from=build-stage /app/bin ./bin
COPY --from=build-stage /app/view ./view
COPY --from=build-stage /app/public ./public

# 清理 devDependencies
RUN pnpm prune --prod

# 暴露端口
EXPOSE 9802

# 启动
CMD ["node", "server.js"]
