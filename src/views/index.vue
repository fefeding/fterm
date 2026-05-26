<template>
  <div class="fterm-layout">
    <!-- 侧边栏 -->
    <TerminalSidebar
      :connections="store.connections"
      :loading="store.loading"
      :collapsed="store.sidebarCollapsed"
      @connect="handleConnect"
      @add-connection="openEditor()"
      @edit-connection="openEditor"
      @delete-connection="handleDelete"
      @refresh="handleRefresh"
      @toggle-sidebar="store.toggleSidebar()"
    />

    <!-- 主区域 -->
    <div class="main-area">
      <!-- 工具栏 -->
      <div class="toolbar" style="height: var(--toolbar-height);">
        <button
          v-if="store.sidebarCollapsed"
          class="btn-toolbar"
          @click="store.toggleSidebar()"
          title="展开侧边栏"
        >
          <i class="bi bi-layout-sidebar-inset"></i>
        </button>
        <div class="flex-grow-1"></div>
        <!-- 文件传输按钮（仅在检测到 ZMODEM 时显示） -->
        <button
          v-if="showZmodemBtn"
          class="btn-toolbar"
          @click="handleFileTransfer"
          title="文件传输 (rz/sz)"
        >
          <i class="bi bi-arrow-left-right me-1"></i>文件传输
        </button>
        <button class="btn-toolbar" @click="openEditor()" title="新增连接">
          <i class="bi bi-plus-lg me-1"></i>新增
        </button>
      </div>

      <!-- Tab 栏 -->
      <div v-if="store.tabs.length > 0" class="tab-bar" style="height: var(--tab-bar-height);">
        <div
          v-for="tab in store.tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: tab.id === store.activeTabId }"
          @click="store.switchTab(tab.id)"
        >
          <span class="status-dot" :class="tab.status"></span>
          <span class="text-truncate flex-grow-1">{{ tab.connectionName }}</span>
          <span class="tab-close" @click.stop="handleCloseTab(tab.id)">
            <i class="bi bi-x"></i>
          </span>
        </div>
        <button class="tab-add-btn" @click="handleOpenLocalShell" title="新建本地 Shell">
          <i class="bi bi-plus"></i>
        </button>
      </div>

      <!-- 终端内容区 -->
      <div class="terminal-area">
        <template v-if="store.tabs.length > 0">
          <div
            v-for="tab in store.tabs"
            :key="tab.id"
            class="terminal-pane"
            :class="{ active: tab.id === store.activeTabId }"
          >
            <TerminalTabComp
              v-if="tab.id === store.activeTabId || renderedTabs.has(tab.id)"
              :ref="el => setTermRef(tab.id, el)"
              :tabId="tab.id"
              :connection="getConnection(tab.connectionId)"
              :active="tab.id === store.activeTabId"
              @status-change="(s, sid) => handleStatusChange(tab.id, s, sid)"
              @zmodem-detected="handleZmodemDetected(tab.id)"
            />
          </div>
        </template>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <i class="bi bi-terminal"></i>
          <div style="font-size: 18px;">fterm 远程终端</div>
          <div style="font-size: 13px;">从左侧选择连接，或创建新的 SSH 连接开始</div>
          <button class="btn btn-outline-primary btn-sm mt-2" @click="openEditor()">
            <i class="bi bi-plus me-1"></i>新增连接
          </button>
        </div>
      </div>
    </div>

    <!-- 连接编辑器 -->
    <ConnectionEditor ref="connectionEditorRef" @saved="handleEditorSaved" />

    <!-- 文件传输对话框 -->
    <FileTransfer ref="fileTransferRef" />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useTerminalStore } from '@/stores/terminal';
import TerminalSidebar from '@/components/terminal-sidebar.vue';
import TerminalTabComp from '@/components/terminal-tab.vue';
import ConnectionEditor from '@/components/connection-editor/index.vue';
import FileTransfer from '@/components/file-transfer.vue';
import type { ConnectionEntity, TerminalTab as TerminalTabType } from '@/typings/connection';

const store = useTerminalStore();
const connectionEditorRef = ref<InstanceType<typeof ConnectionEditor>>();
const fileTransferRef = ref<InstanceType<typeof FileTransfer>>();
const showZmodemBtn = ref(false);
const activeZmodemTabId = ref<string | null>(null);

// 已渲染的 tab 集合（保持非活跃 tab 的终端实例不被销毁）
const renderedTabs = new Set<string>();

// 终端组件引用映射
const termRefs = new Map<string, InstanceType<typeof TerminalTabComp>>();

function setTermRef(tabId: string, el: any) {
  if (el) {
    termRefs.set(tabId, el);
    renderedTabs.add(tabId);
  } else {
    termRefs.delete(tabId);
    renderedTabs.delete(tabId);
  }
}

// 获取连接信息
function getConnection(connectionId: string): ConnectionEntity {
  if (connectionId === '__local__') {
    return store.getLocalShellConnection();
  }
  return store.connections.find(c => c.id === connectionId) || { name: '', host: '', username: '' };
}

// 连接操作
function handleConnect(conn: ConnectionEntity) {
  store.openTab(conn);
}

// 打开本地 Shell
function handleOpenLocalShell() {
  store.openLocalShell();
}

// 打开编辑器
function openEditor(conn?: ConnectionEntity) {
  connectionEditorRef.value?.open(conn);
}

// 编辑器保存回调
function handleEditorSaved() {
  store.loadConnections();
}

// 删除连接
async function handleDelete(conn: ConnectionEntity) {
  if (conn.id) {
    await store.deleteConnection(conn.id);
  }
}

// 刷新连接列表
function handleRefresh() {
  store.loadConnections();
}

// 关闭 Tab
function handleCloseTab(tabId: string) {
  store.closeTab(tabId);
  termRefs.delete(tabId);
  renderedTabs.delete(tabId);
}

// Tab 状态变化
function handleStatusChange(tabId: string, status: TerminalTabType['status'], sessionId?: string) {
  store.updateTabStatus(tabId, status, sessionId);
}

// ZMODEM 检测
function handleZmodemDetected(tabId: string) {
  showZmodemBtn.value = true;
  activeZmodemTabId.value = tabId;
}

// 文件传输
function handleFileTransfer() {
  const tabId = activeZmodemTabId.value || store.activeTabId;
  if (!tabId) return;
  const termRef = termRefs.get(tabId);
  if (termRef) {
    fileTransferRef.value?.show(tabId, termRef);
  }
}

// 快捷键
function handleKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + T: 新建连接（如果无连接可选）
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    // 不拦截浏览器默认行为
  }
  // Ctrl/Cmd + W: 关闭当前 tab
  if ((e.ctrlKey || e.metaKey) && e.key === 'w' && store.activeTabId) {
    e.preventDefault();
    handleCloseTab(store.activeTabId);
  }
  // Ctrl/Cmd + 数字: 切换 tab
  if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
    e.preventDefault();
    const idx = parseInt(e.key) - 1;
    if (store.tabs[idx]) {
      store.switchTab(store.tabs[idx].id);
    }
  }
  // Ctrl/Cmd + B: 切换侧边栏
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    store.toggleSidebar();
  }
}

onMounted(async () => {
  await store.loadConnections();
  await restoreOrCreateTabs();
  document.addEventListener('keydown', handleKeydown);
});

/**
 * 恢复上次保存的 TAB，或创建默认本地 Shell
 */
async function restoreOrCreateTabs() {
  const savedTabs = store.restoreTabs();

  if (savedTabs.length > 0) {
    // 恢复保存的 TAB
    for (const saved of savedTabs) {
      if (saved.connectionId === '__local__') {
        // 本地 Shell TAB，直接创建
        store.openLocalShell();
      } else {
        // SSH 连接 TAB，检查连接是否存在
        const conn = store.connections.find(c => c.id === saved.connectionId);
        if (conn) {
          store.openTab(conn);
        }
      }
    }
    // 如果有恢复的 TAB，切换到第一个
    if (store.tabs.length > 0) {
      store.switchTab(store.tabs[0].id);
      return;
    }
  }

  // 没有可恢复的 TAB，自动创建本地 Shell
  store.openLocalShell();
}
</script>

<style scoped>
.fterm-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-dark);
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.terminal-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.terminal-pane {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: none;
}

.terminal-pane.active {
  display: block;
}

.btn-toolbar {
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-toolbar:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.tab-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: auto 4px auto 2px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
}

.tab-add-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}
</style>
