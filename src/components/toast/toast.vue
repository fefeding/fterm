<template>
    <div class="toast-container position-fixed top-0 start-50 translate-middle-x p-3">
      <div
        :class="`toast show bg-${toast.type==='error'?'danger': toast.type}-subtle ${toast.removed? 'fade-out': ''}`"
        role="alert"
        v-for="(toast, index) in toasts"
        :key="index"
      >
        <div class="toast-header" v-if="toast.title">
          <strong class="me-auto">{{ toast.title }}</strong>
          <button type="button" class="btn-close" @click="removeToast(index)"></button>
        </div>
        <div class="toast-body">{{ toast.message }}</div>
      </div>
    </div>
</template>

<script lang="ts" setup>
import { reactive } from 'vue';

const toasts = reactive<Array<any>>([]);
const addToast = (title: string, message: string, type: string = 'success', duration = 3000) => {
    const toast = { title, message, type, removed: false };
    toasts.push(toast);
    setTimeout(() => removeToast(toast), duration);
};
const removeToast = (toast: any) => {
    const index = toasts.indexOf(toast);
    if (index < 0) return;
    toasts[index].removed = true;
    setTimeout(() => { toasts.splice(index, 1); }, 1000);
};

defineExpose({ addToast });
</script>

<style scoped>
.toast-container { z-index: 1100; }
.fade-out { animation: fadeOut 1s forwards; }
@keyframes fadeOut {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-120%); }
}
</style>
