/**
 * @file 生产环境启动入口
 * @description Node.js 生产环境启动脚本，启动 Express + WebSocket 服务
 * 
 * 启动方式：
 * - 直接运行：node bootstrap.js
 * - PM2 管理：npm start / npm restart / npm stop
 * 
 * 环境变量：
 * - PORT: 服务端口（默认 9801）
 */
const pkg = require('./package.json');
process.env.NODE_ENV = 'production';
process.title = process.env.SERVICE_NAME || pkg.name || 'fterm-server';

// 全局异常处理
process.on('uncaughtException', (err) => {
    console.error('[FATAL] uncaughtException:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] unhandledRejection at:', promise, 'reason:', reason);
});

// 启动 Express 服务
require('./server.js');
