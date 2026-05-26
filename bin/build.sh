#!/bin/sh
set -e

echo '清空构建目录...'
rm -rf ./dist/*

echo '构建前端资源...'
npm run build-only

echo '构建完成'
echo '运行 node server.js 启动生产服务'
