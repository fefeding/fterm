import { fileURLToPath, URL } from 'node:url';
import * as http from "node:http";
import * as url from "node:url";
import { defineConfig, type Connect, type PluginOption } from 'vite';

import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import CopyPlugin from 'vite-plugin-files-copy';
import ViteNunjucksPlugin from '@fefeding/vite-nunjucks-plugin';
import * as path from 'path';
import * as fs from 'fs';

const urlPrefix = process.env.PREFIX ? `/${process.env.PREFIX}` : '';

const defaultInitState = {
    "config": {"prefix": urlPrefix, "apiUrl": process.env.API_URL||""},
    "title": process.env.TITLE || 'fterm远程终端'
};

const nunjucksPlugin = ViteNunjucksPlugin({
    variables: {
        prefix: '',
        viteTarget: '',
        __DEFAULTINITIAL_STATE__: JSON.stringify(defaultInitState),
    }
});

const viewDir = path.resolve(__dirname, './view');

const config = defineConfig({
    publicDir: false,
    plugins: [
        vue() as PluginOption,
        vueJsx() as PluginOption,
        // @ts-ignore
        CopyPlugin({ patterns: [] }),
        nunjucksPlugin,
        {
            name: 'copy-server-files',
            writeBundle: async () => {
                const serverSrcDir = path.resolve(__dirname, './server');
                const serverDistDir = path.resolve(__dirname, './dist/server');
                if (!fs.existsSync(serverDistDir)) {
                    fs.mkdirSync(serverDistDir, { recursive: true });
                }
                const copyRecursiveSync = (src: string, dest: string) => {
                    const exists = fs.existsSync(src);
                    const stats = exists ? fs.statSync(src) : null;
                    const isDirectory = exists && stats && stats.isDirectory();
                    if (isDirectory) {
                        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
                        fs.readdirSync(src).forEach(childItemName => {
                            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
                        });
                    } else {
                        if (src.endsWith('.ts') || src.endsWith('.js')) fs.copyFileSync(src, dest);
                    }
                };
                copyRecursiveSync(serverSrcDir, serverDistDir);
                console.log('Server files copied to', serverDistDir);
            }
        },
        {
            name: 'fix-html-paths',
            writeBundle: async () => {
                const publicDir = path.resolve(__dirname, './dist/public');
                const htmlPath = path.join(publicDir, 'view/index.html');
                if (fs.existsSync(htmlPath)) {
                    let html = fs.readFileSync(htmlPath, 'utf-8');
                    html = html.replace(/\.\.\/([a-zA-Z0-9_-]+\.(js|css|woff|woff2|png|jpg|jpeg|gif|svg|ico))/g, '/public/$1');
                    fs.writeFileSync(htmlPath, html);
                }
                const viewHtmlPath = path.join(publicDir, 'view/index.html');
                const destViewDir = path.resolve(__dirname, './dist/view');
                const destViewHtmlPath = path.join(destViewDir, 'index.html');
                if (fs.existsSync(viewHtmlPath)) {
                    if (!fs.existsSync(destViewDir)) fs.mkdirSync(destViewDir, { recursive: true });
                    let html = fs.readFileSync(viewHtmlPath, 'utf-8');
                    fs.writeFileSync(destViewHtmlPath, html);
                    fs.unlinkSync(viewHtmlPath);
                }
            }
        },
        {
            name: 'vite-plugin-spa-fallback-with-nunjucks',
            configureServer(server) {
                return () => {
                    server.middlewares.use(async (req: http.IncomingMessage, res: http.ServerResponse, next: Connect.NextFunction) => {
                        const requestUrl = req.url || '';
                        if (requestUrl.startsWith('/api/') || requestUrl.startsWith('/ws/')) return next();
                        if (requestUrl !== '/index.html' && /\.[a-zA-Z0-9]{1,4}$/.test(requestUrl) || requestUrl.includes('@vite/client')) return next();
                        try {
                            const indexPath = path.resolve(viewDir, 'index.html');
                            if (!fs.existsSync(indexPath)) return next();
                            let html = fs.readFileSync(indexPath, 'utf-8');
                            html = await nunjucksPlugin.transformIndexHtml(html, { path: indexPath });
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'text/html');
                            res.end(html);
                        } catch (e: any) {
                            return next(e);
                        }
                    });
                };
            },
        },
        {
            name: 'server-api',
            configureServer(server) {
                server.middlewares.use((req: Connect.IncomingMessage, res: http.ServerResponse, next: Connect.NextFunction) => {
                    if (req.url?.startsWith('/api/')) {
                        if (!serverRoute(req, res, next)) {
                            res.statusCode = 404;
                            res.end('Not Found');
                        }
                    } else {
                        next();
                    }
                });
            },
        },
        {
            name: 'server-ws',
            async configureServer(server) {
                // 开发模式下在 Vite HTTP server 上直接启动 WebSocket
                try {
                    const serverPath = path.resolve(__dirname, 'dist/server/index.js');
                    if (!fs.existsSync(serverPath)) {
                        console.warn('[WS] dist/server/index.js not found, WebSocket will not be available');
                        console.warn('[WS] Run `pnpm run build-only` first');
                        return;
                    }
                    const serverModule = await import(serverPath);
                    const { sshService } = serverModule;
                    if (!sshService) {
                        console.warn('[WS] sshService not found in server module');
                        return;
                    }

                    const WebSocket = require('ws');
                    const wss = new WebSocket.Server({ server: server.httpServer, path: '/ws/terminal' });
                    console.log('[WS] WebSocket server attached to Vite dev server at /ws/terminal');

                    wss.on('connection', async (ws: any) => {
                        console.log('[WS] Client connected to Vite dev WebSocket');
                        let sessionId: string | null = null;

                        ws.on('message', async (raw: Buffer) => {
                            let msg: any;
                            try {
                                msg = JSON.parse(raw.toString());
                            } catch (e) {
                                ws.send(JSON.stringify({ type: 'error', data: 'Invalid message format' }));
                                return;
                            }

                            const { type, sessionId: sid, data } = msg;
                            switch (type) {
                                case 'create': {
                                    const { connectionId, cols, rows } = data || {};
                                    if (!connectionId) {
                                        ws.send(JSON.stringify({ type: 'error', data: 'Missing connectionId' }));
                                        return;
                                    }
                                    sessionId = sid || `ssh-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
                                    try {
                                        const sshSession = await sshService.createSession(sessionId, connectionId, cols || 80, rows || 24);
                                        sshSession.stream.on('data', (chunk: Buffer) => {
                                            if (ws.readyState === WebSocket.OPEN) {
                                                ws.send(JSON.stringify({ type: 'terminal', sessionId, data: chunk.toString('utf-8') }));
                                            }
                                        });
                                        sshSession.stream.on('close', () => {
                                            if (ws.readyState === WebSocket.OPEN) {
                                                ws.send(JSON.stringify({ type: 'close', sessionId }));
                                            }
                                        });
                                        ws.send(JSON.stringify({ type: 'status', sessionId, data: 'connected' }));
                                    } catch (err: any) {
                                        ws.send(JSON.stringify({ type: 'error', sessionId, data: err.message || 'SSH connection failed' }));
                                    }
                                    break;
                                }
                                case 'terminal': {
                                    if (sid) sshService.writeData(sid, data);
                                    break;
                                }
                                case 'resize': {
                                    if (sid) sshService.resize(sid, data.cols, data.rows);
                                    break;
                                }
                                case 'close': {
                                    if (sid) sshService.closeSession(sid);
                                    break;
                                }
                            }
                        });

                        ws.on('close', () => {
                            if (sessionId) sshService.closeSession(sessionId);
                        });
                    });
                } catch (e) {
                    console.error('[WS] Failed to start WebSocket server:', e);
                }
            },
        },
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '#': fileURLToPath(new URL('../', import.meta.url)),
        },
    },
    build: {
        outDir: 'dist/public',
        assetsInlineLimit: 4096,
        manifest: true,
        minify: false,
        modulePreload: true,
        rollupOptions: {
            external: ['../../server/index', './server/index'],
            input: getViewInputs(viewDir),
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
                manualChunks(id) {
                    const ms = [...id.matchAll(/\/node_modules\/([^\/]+)\//ig)];
                    if (ms && ms.length) {
                        const m = ms[ms.length - 1];
                        if (m && m[1]) {
                            if (m[1].includes('@vue') || m[1].includes('vue-') || m[1] == 'vue') return 'vue';
                            if (m[1].includes('bootstrap')) return 'bootstrap';
                            if (m[1].includes('xterm')) return 'xterm';
                        }
                    }
                }
            }
        },
    },
    base: urlPrefix,
    server: {
        host: '0.0.0.0',
        port: +`${process.env.VITE_PORT}` || 9801,
        cors: true,
    },
});
export default config;

function getViewInputs(dir: string): { [key: string]: string } {
    const entries = fs.readdirSync(dir);
    const htmlFiles = entries.filter(filename => filename.endsWith('.html'));
    const inputObj: { [key: string]: string } = {};
    for (const file of htmlFiles) {
        const name = path.basename(file, '.html');
        inputObj[name] = path.resolve(dir, file);
    }
    return inputObj;
}

async function serverRoute(req: Connect.IncomingMessage, res: http.ServerResponse, next: Connect.NextFunction) {
    try {
        if (!req.url?.startsWith('/api/')) return next();
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname || '';
        const method = req.method?.toLowerCase();
        if (method !== 'post') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ret: 405, msg: 'Only POST method is allowed' }));
            return true;
        }
        const body = await getRequestBody(req);
        if (pathname.startsWith('/api/connection/') || pathname.startsWith('/api/terminal/')) {
            try {
                const serverModule = await import('./server/index');
                const data = await serverModule.handleRoutes(pathname, body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ret: 0, msg: 'success', data }));
            } catch (error: any) {
                console.error(error);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ret: 500, msg: error?.message || '系统异常' }));
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ret: 404, msg: 'API not found' }));
        }
    } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ret: 500, msg: error.message || 'Internal server error' }));
    }
    return true;

    async function getRequestBody(req: http.IncomingMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
            req.on('error', reject);
        });
    }
}
