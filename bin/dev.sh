#!/bin/sh
export VITE_PORT=${VITE_PORT:-$((RANDOM % 7001 + 2000))}
export IP="127.0.0.1"
npm run dev
echo "$VITE_PORT 前端端口"
