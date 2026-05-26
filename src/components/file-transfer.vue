<template>
  <Modal
    ref="modalRef"
    :title="t('fileTransfer.title')"
    :closeButton="{ text: t('common.close'), show: true }"
    :confirmButton="{ text: '', show: false }"
    :style="{ maxWidth: '500px', width: '100%' }"
    @onClose="handleClose"
  >
    <div class="file-transfer-body">
      <!-- 操作选择 -->
      <div class="d-flex gap-2 mb-3">
        <button
          class="btn flex-fill"
          :class="mode === 'upload' ? 'btn-primary' : 'btn-outline-secondary'"
          @click="mode = 'upload'"
        >
          <i class="bi bi-upload me-1"></i>{{ t('fileTransfer.upload') }}
        </button>
        <button
          class="btn flex-fill"
          :class="mode === 'download' ? 'btn-primary' : 'btn-outline-secondary'"
          @click="mode = 'download'"
        >
          <i class="bi bi-download me-1"></i>{{ t('fileTransfer.download') }}
        </button>
      </div>

      <!-- 上传模式 -->
      <div v-if="mode === 'upload'">
        <div
          class="drop-zone"
          :class="{ dragging: isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <i class="bi bi-cloud-upload" style="font-size: 32px;"></i>
          <div class="mt-2">{{ t('fileTransfer.dropZone') }}</div>
          <div class="mt-1" style="font-size: 12px; color: var(--text-secondary);">
            {{ t('fileTransfer.multiFileSupport') }}
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          style="display: none;"
          @change="handleFileSelect"
        >
      </div>

      <!-- 下载模式 -->
      <div v-if="mode === 'download'">
        <div class="mb-3">
          <label class="form-label">{{ t('fileTransfer.remotePath') }}</label>
          <input
            type="text"
            class="form-control"
            v-model="remoteFilePath"
            :placeholder="t('fileTransfer.remotePathPlaceholder')"
            style="background: #313244; border-color: #45475a; color: var(--text-primary);"
          >
        </div>
        <button
          class="btn btn-primary w-100"
          :disabled="!remoteFilePath || transferring"
          @click="startDownload"
        >
          <i class="bi bi-download me-1"></i>{{ t('fileTransfer.startDownload') }}
        </button>
      </div>

      <!-- 传输进度 -->
      <div v-if="transferring || transferHistory.length > 0" class="mt-3">
        <div class="fw-bold mb-2" style="font-size: 13px;">{{ t('fileTransfer.transferHistory') }}</div>
        <div class="transfer-list">
          <!-- 当前传输 -->
          <div v-if="currentProgress" class="transfer-item">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="text-truncate" style="font-size: 13px;">
                <i :class="currentProgress.direction === 'upload' ? 'bi bi-upload' : 'bi bi-download'" class="me-1"></i>
                {{ currentProgress.fileName }}
              </span>
              <span style="font-size: 12px; color: var(--text-secondary);">
                {{ formatSize(currentProgress.bytesSent) }} / {{ formatSize(currentProgress.bytesTotal) }}
              </span>
            </div>
            <div class="progress" style="height: 4px;">
              <div
                class="progress-bar"
                :class="currentProgress.state === 'error' ? 'bg-danger' : 'bg-primary'"
                :style="{ width: currentProgress.percent + '%' }"
              ></div>
            </div>
            <div v-if="currentProgress.state === 'error'" class="text-danger" style="font-size: 12px;">
              {{ t('fileTransfer.transferFailed') }}
            </div>
          </div>

          <!-- 历史记录 -->
          <div
            v-for="(item, idx) in transferHistory"
            :key="idx"
            class="transfer-item"
          >
            <div class="d-flex align-items-center justify-content-between">
              <span class="text-truncate" style="font-size: 13px;">
                <i :class="item.direction === 'upload' ? 'bi bi-upload' : 'bi bi-download'" class="me-1"></i>
                {{ item.fileName }}
              </span>
              <span
                style="font-size: 12px;"
                :class="item.state === 'complete' ? 'text-success' : 'text-danger'"
              >
                {{ item.state === 'complete' ? t('fileTransfer.complete') : t('fileTransfer.failed') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="transferring" class="mt-3 text-center">
        <button class="btn btn-outline-danger btn-sm" @click="cancelTransfer">
          <i class="bi bi-x-circle me-1"></i>{{ t('fileTransfer.cancelTransfer') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/modal/index.vue';
import { ZmodemSession, formatFileSize, type ZmodemProgress } from '@/utils/zmodem';
import { toast } from '@/utils/toast';

const { t } = useI18n();

const modalRef = ref();
const fileInput = ref<HTMLInputElement>();
const mode = ref<'upload' | 'download'>('upload');
const isDragging = ref(false);
const remoteFilePath = ref('');
const transferring = ref(false);
const currentProgress = ref<ZmodemProgress | null>(null);
const transferHistory = ref<ZmodemProgress[]>([]);

let zmodemSession: ZmodemSession | null = null;
let activeTermRef: any = null;
let activeTabId: string | null = null;

function show(tabId: string, termRef: any) {
  activeTabId = tabId;
  activeTermRef = termRef;
  mode.value = 'upload';
  currentProgress.value = null;
  transferHistory.value = [];
  transferring.value = false;
  modalRef.value?.show();
}

function handleClose() {
  if (transferring.value) {
    cancelTransfer();
  }
  activeTermRef = null;
  activeTabId = null;
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleDrop(e: DragEvent) {
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files?.length) {
    startUpload(Array.from(files));
  }
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) {
    startUpload(Array.from(input.files));
    input.value = '';
  }
}

async function startUpload(files: File[]) {
  if (!activeTermRef) {
    toast.error(t('fileTransfer.terminalNotConnected'));
    return;
  }

  transferring.value = true;
  zmodemSession = new ZmodemSession();

  zmodemSession
    .onData((data) => {
      // 通过终端 WebSocket 发送数据
      const term = activeTermRef?.getTerminal?.();
      if (term) {
        // 将数据发送到 SSH 会话
        if (typeof data === 'string') {
          term.paste?.(data);
        }
      }
    })
    .onProgress((progress) => {
      currentProgress.value = { ...progress };
    })
    .onComplete(() => {
      if (currentProgress.value) {
        transferHistory.value.unshift({
          ...currentProgress.value,
          state: 'complete',
          percent: 100,
        });
      }
      currentProgress.value = null;
      transferring.value = false;
      toast.success(t('fileTransfer.uploadComplete'));
    })
    .onError((error) => {
      if (currentProgress.value) {
        transferHistory.value.unshift({
          ...currentProgress.value,
          state: 'error',
        });
      }
      currentProgress.value = null;
      transferring.value = false;
      toast.error(error.message || t('fileTransfer.uploadFailed'));
    });

  await zmodemSession.startUpload(files);
}

function startDownload() {
  if (!remoteFilePath.value) {
    toast.warning(t('fileTransfer.remotePathRequired'));
    return;
  }

  transferring.value = true;
  zmodemSession = new ZmodemSession();

  const fileName = remoteFilePath.value.split('/').pop() || 'download';

  zmodemSession
    .onData((data) => {
      const term = activeTermRef?.getTerminal?.();
      if (term && typeof data === 'string') {
        term.paste?.(data);
      }
    })
    .onProgress((progress) => {
      currentProgress.value = { ...progress };
    })
    .onComplete(() => {
      if (currentProgress.value) {
        transferHistory.value.unshift({
          ...currentProgress.value,
          state: 'complete',
          percent: 100,
        });
      }
      currentProgress.value = null;
      transferring.value = false;
      toast.success(t('fileTransfer.downloadComplete'));
    })
    .onError((error) => {
      if (currentProgress.value) {
        transferHistory.value.unshift({
          ...currentProgress.value,
          state: 'error',
        });
      }
      currentProgress.value = null;
      transferring.value = false;
      toast.error(error.message || t('fileTransfer.downloadFailed'));
    });

  zmodemSession.startDownload(fileName);
}

function cancelTransfer() {
  zmodemSession?.cancel();
  transferring.value = false;
  if (currentProgress.value) {
    transferHistory.value.unshift({
      ...currentProgress.value,
      state: 'error',
    });
  }
  currentProgress.value = null;
}

function formatSize(bytes: number): string {
  return formatFileSize(bytes);
}

defineExpose({ show });
</script>

<style scoped>
.file-transfer-body {
  padding: 0.5rem;
}

.drop-zone {
  border: 2px dashed #45475a;
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--accent);
  background-color: rgba(137, 180, 250, 0.05);
  color: var(--text-primary);
}

.transfer-list {
  max-height: 200px;
  overflow-y: auto;
}

.transfer-item {
  padding: 8px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.03);
  margin-bottom: 6px;
}
</style>
