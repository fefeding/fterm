import { defineStore } from 'pinia';
import { ConnectionService } from '@/service/connection';
import type { ConnectionEntity, TerminalTab } from '@/typings/connection';
import { toast } from '@/utils/toast';
import { modal } from '@/utils/modal';

const TABS_STORAGE_KEY = 'fterm_saved_tabs';

/** 保存的 TAB 信息（用于持久化） */
interface SavedTab {
  connectionId: string;
  connectionName: string;
}

export type TerminalState = {
  connections: ConnectionEntity[];
  tabs: TerminalTab[];
  activeTabId: string | null;
  loading: boolean;
  sidebarCollapsed: boolean;
};

const connectionService = new ConnectionService();

function getDefaultState(): TerminalState {
  return {
    connections: [],
    tabs: [],
    activeTabId: null,
    loading: false,
    sidebarCollapsed: false,
  };
}

export const useTerminalStore = defineStore('terminal', {
  state: (): TerminalState => getDefaultState(),

  getters: {
    activeTab: (state) => state.tabs.find(t => t.id === state.activeTabId) || null,
    tabCount: (state) => state.tabs.length,
    connectionCount: (state) => state.connections.length,
  },

  actions: {
    // 加载连接列表
    async loadConnections() {
      this.loading = true;
      try {
        const result = await connectionService.getAllConnections();
        if (result?.ret === 0) {
          this.connections = result.data || [];
        } else if (Array.isArray(result)) {
          this.connections = result;
        }
      } catch (e: any) {
        toast.error(e.message || '加载连接列表失败');
      } finally {
        this.loading = false;
      }
    },

    // 添加连接
    async addConnection(connection: ConnectionEntity) {
      return connectionService.addConnection(connection);
    },

    // 更新连接
    async updateConnection(id: string, updates: Partial<ConnectionEntity>) {
      return connectionService.updateConnection(id, updates);
    },

    // 删除连接
    async deleteConnection(id: string) {
      const confirmed = await modal.confirm('确定删除该连接？');
      if (!confirmed) return false;
      try {
        await connectionService.deleteConnection(id);
        this.connections = this.connections.filter(c => c.id !== id);
        // 关闭关联的 tabs
        this.tabs = this.tabs.filter(t => t.connectionId !== id);
        toast.success('已删除');
        return true;
      } catch (e: any) {
        toast.error(e.message || '删除失败');
        return false;
      }
    },

    // 打开新终端 Tab
    openTab(connection: ConnectionEntity) {
      const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const tab: TerminalTab = {
        id: tabId,
        connectionId: connection.id || '',
        connectionName: connection.name,
        status: 'connecting',
        cols: connection.terminal?.cols || 80,
        rows: connection.terminal?.rows || 24,
      };
      this.tabs.push(tab);
      this.activeTabId = tabId;
      this.saveTabs();
      return tab;
    },

    // 关闭 Tab
    closeTab(tabId: string) {
      const index = this.tabs.findIndex(t => t.id === tabId);
      if (index === -1) return;
      this.tabs.splice(index, 1);
      if (this.activeTabId === tabId) {
        this.activeTabId = this.tabs.length > 0 ? this.tabs[Math.min(index, this.tabs.length - 1)]?.id || null : null;
      }
      this.saveTabs();
    },

    // 更新 Tab 状态
    updateTabStatus(tabId: string, status: TerminalTab['status'], sessionId?: string) {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.status = status;
        if (sessionId) tab.sessionId = sessionId;
      }
    },

    // 切换活动 Tab
    switchTab(tabId: string) {
      this.activeTabId = tabId;
      this.saveTabs();
    },

    // 切换侧边栏
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },

    // 保存 TAB 状态到 localStorage
    saveTabs() {
      try {
        const saved: SavedTab[] = this.tabs.map(t => ({
          connectionId: t.connectionId,
          connectionName: t.connectionName,
        }));
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(saved));
      } catch (e) {
        console.warn('保存 TAB 状态失败:', e);
      }
    },

    // 从 localStorage 恢复 TAB 状态
    restoreTabs(): SavedTab[] {
      try {
        const data = localStorage.getItem(TABS_STORAGE_KEY);
        if (data) {
          return JSON.parse(data) as SavedTab[];
        }
      } catch (e) {
        console.warn('恢复 TAB 状态失败:', e);
      }
      return [];
    },

    // 创建本地 Shell TAB（不保存到连接列表，每次新建）
    openLocalShell() {
      const LOCAL_SHELL_ID = '__local__';
      // 计算本地 Shell Tab 序号，用于显示名称
      const localCount = this.tabs.filter(t => t.connectionId === LOCAL_SHELL_ID).length;
      const tabName = localCount === 0 ? '本地 Shell' : `本地 Shell ${localCount + 1}`;

      const tabId = `tab-local-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const tab: TerminalTab = {
        id: tabId,
        connectionId: LOCAL_SHELL_ID,
        connectionName: tabName,
        status: 'connecting',
        cols: 80,
        rows: 24,
      };
      this.tabs.push(tab);
      this.activeTabId = tabId;
      this.saveTabs();
      return tab;
    },

    // 获取本地 Shell 连接信息（虚拟连接，不保存）
    getLocalShellConnection(): ConnectionEntity {
      return {
        id: '__local__',
        name: '本地 Shell',
        type: 'local',
        host: '',
        username: '',
        shell: '',
        terminal: {
          cols: 80, rows: 24, fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: 'dark',
          cursorStyle: 'block' as 'block' | 'underline' | 'bar',
        },
      };
    },
  },
});
