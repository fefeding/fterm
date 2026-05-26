<template>
  <div class="terminal-wrapper" ref="terminalWrapper">
    <div class="terminal-container" ref="terminalContainer"></div>
    <div v-if="status === 'connecting'" class="terminal-status">
      <div class="spinner-border spinner-border-sm text-warning me-2"></div>
      正在连接...
    </div>
    <div v-if="status === 'error'" class="terminal-status text-danger">
      <i class="bi bi-exclamation-triangle me-2"></i>
      连接失败: {{ errorMessage }}
    </div>
    <div v-if="status === 'disconnected'" class="terminal-status text-secondary">
      <i class="bi bi-wifi-off me-2"></i>
      连接已断开
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { ConnectionEntity, WSMessage } from '@/typings/connection';

const props = defineProps<{
  tabId: string;
  connection: ConnectionEntity;
  active: boolean;
}>();

const emit = defineEmits<{
  (e: 'status-change', status: 'connecting' | 'connected' | 'disconnected' | 'error', sessionId?: string): void;
  (e: 'zmodem-detected'): void;
}>();

const terminalWrapper = ref<HTMLElement>();
const terminalContainer = ref<HTMLElement>();
const status = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
const errorMessage = ref('');

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let ws: WebSocket | null = null;
let sessionId: string | null = null;
let resizeObserver: ResizeObserver | null = null;

// 初始化终端
function initTerminal() {
  if (!terminalContainer.value) return;

  terminal = new Terminal({
    cols: props.connection.terminal?.cols || 80,
    rows: props.connection.terminal?.rows || 24,
    fontSize: props.connection.terminal?.fontSize || 14,
    fontFamily: props.connection.terminal?.fontFamily || '"JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
    theme: props.connection.terminal?.theme === 'light' ? {
      background: '#eff1f5',
      foreground: '#4c4f69',
      cursor: '#dc8a78',
      cursorAccent: '#eff1f5',
      selectionBackground: '#acb0be40',
      selectionForeground: '#4c4f69',
      black: '#5c5f77', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d',
      blue: '#1e66f5', magenta: '#ea76cb', cyan: '#179299', white: '#acb0be',
      brightBlack: '#6c6f85', brightRed: '#d20f39', brightGreen: '#40a02b', brightYellow: '#df8e1d',
      brightBlue: '#1e66f5', brightMagenta: '#ea76cb', brightCyan: '#179299', brightWhite: '#bcc0cc',
    } : {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#585b7066',
      selectionForeground: '#cdd6f4',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
      brightBlue: '#89b4fa', brightMagenta: '#f5c2e7', brightCyan: '#94e2d5', brightWhite: '#a6adc8',
    },
    cursorStyle: props.connection.terminal?.cursorStyle || 'block',
    cursorBlink: true,
    cursorInactiveStyle: 'outline',
    scrollback: 5000,
    lineHeight: 1.2,
    letterSpacing: 0.5,
    allowProposedApi: true,
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());

  terminal.open(terminalContainer.value);

  // 自适应大小
  nextTick(() => {
    fitAddon?.fit();
  });

  // 监听用户输入
  terminal.onData((data) => {
    sendToServer({ type: 'terminal', sessionId: sessionId || undefined, data });
  });

  // 监听二进制数据
  terminal.onBinary((data) => {
    sendToServer({ type: 'terminal', sessionId: sessionId || undefined, data });
  });

  // 监听大小变化
  terminal.onResize(({ cols, rows }) => {
    sendToServer({ type: 'resize', sessionId: sessionId || undefined, data: { cols, rows } });
  });
}

// WebSocket 连接
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/ws/terminal`;
  console.log(`[TerminalTab] Connecting to WebSocket: ${wsUrl}`);

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log(`[TerminalTab] WebSocket connected, sending create`);
    // 发送创建会话请求
    sendToServer({
      type: 'create',
      data: {
        connectionId: props.connection.id,
        cols: terminal?.cols || 80,
        rows: terminal?.rows || 24,
      }
    });
  };

  ws.onmessage = (event) => {
    const dataStr = typeof event.data === 'string' ? event.data : '[binary]';
    console.log(`[TerminalTab] WS message:`, dataStr.substring(0, 100));
    try {
      const msg: WSMessage = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (e) {
      console.error('WebSocket message parse error:', e);
    }
  };

  ws.onerror = (err) => {
    console.error('[TerminalTab] WebSocket error:', err);
    setStatus('error', 'WebSocket 连接失败');
  };

  ws.onclose = (event) => {
    console.log(`[TerminalTab] WebSocket closed, code: ${event.code}, reason: ${event.reason}`);
    if (status.value !== 'disconnected') {
      setStatus('disconnected');
    }
  };
}

// 处理服务端消息
function handleServerMessage(msg: WSMessage) {
  switch (msg.type) {
    case 'terminal':
      // SSH 输出数据
      if (msg.data && terminal) {
        terminal.write(msg.data);
        // ZMODEM 检测
        if (typeof msg.data === 'string' && msg.data.includes('\x18B00')) {
          emit('zmodem-detected');
        }
      }
      break;

    case 'status':
      if (msg.sessionId) {
        sessionId = msg.sessionId;
      }
      if (msg.data === 'connected') {
        setStatus('connected', msg.sessionId);
      }
      break;

    case 'close':
      setStatus('disconnected');
      break;

    case 'error':
      setStatus('error', msg.data || '连接失败');
      break;
  }
}

// 发送消息到服务端
function sendToServer(msg: WSMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// 更新状态
function setStatus(s: typeof status.value, detail?: string) {
  status.value = s;
  if (s === 'error' && detail) errorMessage.value = detail;
  emit('status-change', s, sessionId || undefined);
}

// 聚焦终端
function focus() {
  terminal?.focus();
}

// 自适应大小
function fit() {
  nextTick(() => {
    fitAddon?.fit();
  });
}

// 写入数据到终端（用于 ZMODEM 等场景）
function writeToTerminal(data: string) {
  terminal?.write(data);
}

// 获取终端实例
function getTerminal() {
  return terminal;
}

// 监听 active 状态变化，切换时重新 fit
watch(() => props.active, (val) => {
  if (val) {
    nextTick(() => {
      fit();
      focus();
    });
  }
});

onMounted(() => {
  initTerminal();

  // ResizeObserver 监听容器大小变化
  if (terminalWrapper.value) {
    resizeObserver = new ResizeObserver(() => {
      if (props.active) fit();
    });
    resizeObserver.observe(terminalWrapper.value);
  }

  // 建立 WebSocket 连接
  connectWebSocket();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  ws?.close();
  terminal?.dispose();
});

defineExpose({ focus, fit, writeToTerminal, getTerminal, sessionId });
</script>

<style scoped>
.terminal-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.terminal-container {
  width: 100%;
  height: 100%;
  padding: 4px;
}

.terminal-status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  font-size: 14px;
  padding: 12px 24px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  z-index: 10;
}
</style>
