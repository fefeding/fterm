<template>
  <div class="sidebar d-flex flex-column" :style="{ width: collapsed ? '0px' : 'var(--sidebar-width)' }">
    <!-- 顶部工具栏 -->
    <div class="d-flex align-items-center justify-content-between p-2 border-bottom" style="border-color: var(--border-color) !important;">
      <span class="fw-bold" style="color: var(--accent);">
        <i class="bi bi-terminal me-1"></i>fterm
      </span>
      <div class="d-flex gap-1">
        <button class="btn-toolbar" @click="$emit('add-connection')" title="新增连接">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button class="btn-toolbar" @click="$emit('refresh')" title="刷新">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button class="btn-toolbar" @click="$emit('toggle-sidebar')" title="收起侧边栏">
          <i class="bi bi-chevron-left"></i>
        </button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="p-2">
      <input
        type="text"
        class="form-control form-control-sm"
        placeholder="搜索连接..."
        v-model="searchQuery"
        style="background: #313244; border-color: #45475a; color: var(--text-primary);"
      >
    </div>

    <!-- 本地 Shell 快捷入口 -->
    <div class="p-2 border-bottom" style="border-color: var(--border-color) !important;">
      <div
        class="connection-item local-shell-item"
        @click="$emit('open-local-shell')"
      >
        <i class="bi bi-terminal" style="color: var(--accent);"></i>
        <div class="flex-grow-1">
          <div style="font-size: 13px;">本地 Shell</div>
        </div>
        <div class="d-flex gap-1">
          <button class="btn-conn" style="opacity: 1;" @click.stop="$emit('open-local-shell')" title="打开">
            <i class="bi bi-play-fill"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- 连接列表 -->
    <div class="flex-grow-1 overflow-auto">
      <div v-if="loading" class="text-center p-4" style="color: var(--text-secondary);">
        <div class="spinner-border spinner-border-sm me-2"></div>加载中...
      </div>
      <div v-else-if="filteredConnections.length === 0" class="text-center p-4" style="color: var(--text-secondary);">
        <i class="bi bi-inbox" style="font-size: 24px;"></i>
        <div class="mt-2">暂无连接</div>
        <button class="btn btn-sm btn-outline-primary mt-2" @click="$emit('add-connection')">
          <i class="bi bi-plus me-1"></i>添加连接
        </button>
      </div>
      <div v-else>
        <div
          v-for="conn in filteredConnections"
          :key="conn.id"
          class="connection-item"
          @dblclick="$emit('connect', conn)"
          @contextmenu.prevent="showContextMenu($event, conn)"
        >
          <i :class="conn.type === 'local' ? 'bi bi-terminal' : 'bi bi-hdd-network'" style="color: var(--accent);"></i>
          <div class="flex-grow-1 overflow-hidden">
            <div class="text-truncate" style="font-size: 13px;">{{ conn.name }}</div>
            <div class="text-truncate" style="font-size: 11px; color: var(--text-secondary);">
              {{ conn.type === 'local' ? '本地 Shell' : `${conn.username}@${conn.host}:${conn.port}` }}
            </div>
          </div>
          <div class="d-flex gap-1" @click.stop>
            <button class="btn-conn" @click="$emit('connect', conn)" title="连接">
              <i class="bi bi-play-fill"></i>
            </button>
            <button class="btn-conn" @click="$emit('edit-connection', conn)" title="编辑">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn-conn btn-conn-danger" @click="$emit('delete-connection', conn)" title="删除">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="p-2 text-center" style="font-size: 11px; color: var(--text-secondary); border-top: 1px solid var(--border-color);">
      {{ connections.length }} 个连接
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import type { ConnectionEntity } from '@/typings/connection';

const props = defineProps<{
  connections: ConnectionEntity[];
  loading: boolean;
  collapsed: boolean;
}>();

defineEmits<{
  (e: 'connect', conn: ConnectionEntity): void;
  (e: 'add-connection'): void;
  (e: 'edit-connection', conn: ConnectionEntity): void;
  (e: 'delete-connection', conn: ConnectionEntity): void;
  (e: 'refresh'): void;
  (e: 'toggle-sidebar'): void;
  (e: 'open-local-shell'): void;
}>();

const searchQuery = ref('');

const filteredConnections = computed(() => {
  if (!searchQuery.value) return props.connections;
  const q = searchQuery.value.toLowerCase();
  return props.connections.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.host.toLowerCase().includes(q) ||
    c.username.toLowerCase().includes(q)
  );
});

function showContextMenu(_event: MouseEvent, _conn: ConnectionEntity) {
  // 可扩展右键菜单
}
</script>

<style scoped>
.btn-toolbar {
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.btn-toolbar:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.btn-conn {
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 2px 4px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s;
}
.connection-item:hover .btn-conn {
  opacity: 1;
}
.btn-conn:hover {
  color: var(--accent);
}
.btn-conn-danger:hover {
  color: var(--danger);
}
</style>
