<template>
  <Modal 
    ref="connectionModal"
    :title="editingConnection ? '编辑 SSH 连接' : '新增 SSH 连接'"
    :closeButton="{ text: '取消', show: true }"
    :confirmButton="{ text: '', show: false }"
    :style="{ maxWidth: '700px', width: '100%' }"
    @onClose="handleModalClose"
  >
    <form @submit.prevent="saveConnection" class="connection-form">
      <!-- 基本信息 -->
      <div class="mb-3">
        <label class="form-label fw-bold"><i class="bi bi-tag me-1"></i>连接名称 <span class="text-danger">*</span></label>
        <input type="text" class="form-control" v-model="form.name" placeholder="为连接起一个名称" required>
      </div>

      <!-- 连接配置 -->
      <div class="row mb-3">
        <div class="col-8">
          <label class="form-label fw-bold"><i class="bi bi-server me-1"></i>主机地址 <span class="text-danger">*</span></label>
          <input type="text" class="form-control" v-model="form.host" placeholder="服务器 IP 或域名" required>
        </div>
        <div class="col-4">
          <label class="form-label fw-bold"><i class="bi bi-door-closed me-1"></i>端口</label>
          <input type="number" class="form-control" v-model.number="form.port" min="1" max="65535">
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold"><i class="bi bi-person me-1"></i>用户名 <span class="text-danger">*</span></label>
        <input type="text" class="form-control" v-model="form.username" placeholder="SSH 用户名" required>
      </div>

      <!-- 认证方式 -->
      <div class="mb-3">
        <label class="form-label fw-bold"><i class="bi bi-shield-lock me-1"></i>认证方式</label>
        <div class="btn-group w-100" role="group">
          <input type="radio" class="btn-check" name="authType" id="auth-password" value="password" v-model="form.authType">
          <label class="btn btn-outline-primary" for="auth-password"><i class="bi bi-key me-1"></i>密码</label>
          <input type="radio" class="btn-check" name="authType" id="auth-key" value="privateKey" v-model="form.authType">
          <label class="btn btn-outline-primary" for="auth-key"><i class="bi bi-file-earmark-lock me-1"></i>私钥</label>
        </div>
      </div>

      <!-- 密码认证 -->
      <div v-if="form.authType === 'password'" class="mb-3">
        <label class="form-label fw-bold">密码</label>
        <input type="password" class="form-control" v-model="form.password" placeholder="SSH 密码">
      </div>

      <!-- 私钥认证 -->
      <div v-if="form.authType === 'privateKey'" class="mb-3">
        <label class="form-label fw-bold">私钥内容</label>
        <textarea class="form-control" v-model="form.privateKey" rows="5" placeholder="粘贴私钥内容或选择文件..."></textarea>
        <div class="mt-2">
          <label class="form-label">私钥密码（可选）</label>
          <input type="password" class="form-control" v-model="form.passphrase" placeholder="如果私钥有密码保护">
        </div>
        <div class="mt-2">
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="loadPrivateKey">
            <i class="bi bi-folder-open me-1"></i>从文件加载
          </button>
        </div>
      </div>

      <!-- 终端配置 -->
      <div class="card mb-3">
        <div class="card-header" @click="showTerminalConfig = !showTerminalConfig" style="cursor: pointer;">
          <i class="bi bi-terminal me-1"></i>终端配置
          <i :class="showTerminalConfig ? 'bi bi-chevron-up float-end' : 'bi bi-chevron-down float-end'"></i>
        </div>
        <div class="card-body" v-show="showTerminalConfig">
          <div class="row mb-2">
            <div class="col-6">
              <label class="form-label">字体大小</label>
              <input type="number" class="form-control form-control-sm" v-model.number="form.terminal.fontSize" min="8" max="32">
            </div>
            <div class="col-6">
              <label class="form-label">光标样式</label>
              <select class="form-select form-select-sm" v-model="form.terminal.cursorStyle">
                <option value="block">方块</option>
                <option value="underline">下划线</option>
                <option value="bar">竖线</option>
              </select>
            </div>
          </div>
          <div class="row mb-2">
            <div class="col-6">
              <label class="form-label">主题</label>
              <select class="form-select form-select-sm" v-model="form.terminal.theme">
                <option value="dark">暗色</option>
                <option value="light">亮色</option>
              </select>
            </div>
            <div class="col-6">
              <label class="form-label">字体</label>
              <input type="text" class="form-control form-control-sm" v-model="form.terminal.fontFamily" placeholder="字体">
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="d-flex justify-content-between">
        <button type="button" class="btn btn-outline-secondary" @click="testConn" :disabled="testing">
          <span v-if="testing" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-plug me-1"></i>
          {{ testing ? '测试中...' : '测试连接' }}
        </button>
        <div>
          <button type="button" class="btn btn-secondary me-2" @click="close">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </form>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, reactive } from 'vue';
import Modal from '@/components/modal/index.vue';
import { ConnectionService } from '@/service/connection';
import { toast } from '@/utils/toast';

const connectionModal = ref();
const editingConnection = ref<string | null>(null);
const showTerminalConfig = ref(false);
const testing = ref(false);
const saving = ref(false);

const defaultForm = () => ({
  name: '',
  host: '',
  port: 22,
  username: 'root',
  authType: 'password' as 'password' | 'privateKey',
  password: '',
  privateKey: '',
  passphrase: '',
  terminal: {
    cols: 80, rows: 24, fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: 'dark',
    cursorStyle: 'block' as 'block' | 'underline' | 'bar',
  },
  options: {},
  enabled: true,
});

const form = reactive(defaultForm());

const connectionService = new ConnectionService();

function open(connection?: any) {
  if (connection) {
    editingConnection.value = connection.id;
    Object.assign(form, defaultForm(), connection);
  } else {
    editingConnection.value = null;
    Object.assign(form, defaultForm());
  }
  connectionModal.value?.show();
}

function close() {
  connectionModal.value?.hide();
}

function handleModalClose() {
  editingConnection.value = null;
}

async function saveConnection() {
  if (!form.name || !form.host || !form.username) {
    toast.warning('请填写必填字段');
    return;
  }
  saving.value = true;
  try {
    if (editingConnection.value) {
      await connectionService.updateConnection(editingConnection.value, { ...form });
    } else {
      await connectionService.addConnection({ ...form } as any);
    }
    toast.success('保存成功');
    close();
    emit('saved');
  } catch (e: any) {
    toast.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function testConn() {
  if (!form.host || !form.username) {
    toast.warning('请先填写主机和用户名');
    return;
  }
  testing.value = true;
  try {
    const result = await connectionService.testConnection({ ...form } as any);
    if (result) toast.success('连接成功');
    else toast.error('连接失败');
  } catch (e: any) {
    toast.error(e.message || '测试失败');
  } finally {
    testing.value = false;
  }
}

async function loadPrivateKey() {
  // 浏览器环境：创建隐藏的 file input 触发文件选择
  const chooser = document.createElement('input');
  chooser.type = 'file';
  chooser.accept = '.pem,.key,.pub,.rsa';
  chooser.style.display = 'none';
  chooser.addEventListener('change', async () => {
    if (chooser.files?.length) {
      try {
        const text = await (chooser.files[0] as File).text();
        form.privateKey = text;
        toast.success('私钥已加载');
      } catch (e: any) {
        toast.error(e.message || '读取私钥文件失败');
      }
    }
  });
  document.body.appendChild(chooser);
  chooser.click();
  // 清理 DOM
  setTimeout(() => {
    if (chooser.parentNode) document.body.removeChild(chooser);
  }, 0);
}

const emit = defineEmits(['saved']);

defineExpose({ open, close });
</script>

<style scoped>
.connection-form { padding: 0.5rem; }
.card-header { user-select: none; }
</style>
