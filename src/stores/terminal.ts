import { defineStore } from 'pinia';
import { ConnectionService } from '@/service/connection';
import type { ConnectionEntity, TerminalTab } from '@/typings/connection';
import { toast } from '@/utils/toast';
import { modal } from '@/utils/modal';

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
    },

    // 切换侧边栏
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
  },
});
