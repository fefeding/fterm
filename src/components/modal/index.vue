<template>
    <div class="modal fade" :id="modalId" ref="modalContainer" tabindex="-1" aria-labelledby="modalLabel">
        <div class="modal-dialog modal-dialog-centered" :class="{'modal-fullscreen': isFullScreen}">
            <div class="modal-content" :class="contentClass">
                <div class="modal-header" :class="headerClass">
                    <h5 class="modal-title d-flex align-items-center" id="modalLabel">
                        <i v-if="typeIcon" :class="typeIcon" class="me-2"></i>
                        {{ dynamicTitle || props.title }}
                    </h5>
                    <button type="button" class="btn-close" aria-label="Close" @click="cancel"></button>
                </div>
                <div class="modal-body text-wrap" v-if="modalShow">
                    <slot v-if="$slots.default"></slot>
                    <div v-else>
                        <div class="d-flex align-items-center mb-3">
                            <i v-if="typeIcon" :class="typeIcon" class="me-3 fs-1"></i>
                            <div class="flex-grow-1 text-wrap">{{ dynamicContent }}</div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <slot name="footer" v-if="$slots.footer"></slot>
                    <template v-else>
                        <button v-if="dynamicShowCancel || props.closeButton.show" type="button" class="btn btn-secondary" @click="cancel">
                            {{ dynamicCancelText || props.closeButton.text || t('modal.close') }}
                        </button>
                        <button v-if="props.confirmButton.show" type="button" class="btn" :class="confirmButtonClass" @click="confirm">
                            {{ dynamicConfirmText || props.confirmButton.text || t('modal.confirm') }}
                        </button>
                    </template>
                </div>
                <Loading :isLoading="props.isLoading" :message="props.loadingMessage || t('modal.processing')"></Loading>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import * as bootstrap from 'bootstrap';
import Loading from '@/components/loading/index.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const modalId = `modal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const props = defineProps({
    title: { type: String, default: '' },
    closeButton: { type: Object, default: () => ({ text: '', show: false }) },
    confirmButton: { type: Object, default: () => ({ text: '', show: true }) },
    isLoading: { type: Boolean, default: false },
    loadingMessage: { type: String, default: '' },
    visible: { type: Boolean, default: false },
    isFullScreen: { type: Boolean, default: false },
});

const dynamicOptions = ref<any>({});
const dynamicTitle = ref('');
const dynamicContent = ref('');
const dynamicType = ref<'success' | 'error' | 'warning' | 'info' | ''>('');
const dynamicConfirmText = ref('');
const dynamicCancelText = ref('');
const dynamicShowCancel = ref(false);

const typeIcon = computed(() => {
    const map = { success: 'bi bi-check-circle-fill text-success', error: 'bi bi-x-circle-fill text-danger', warning: 'bi bi-exclamation-triangle-fill text-warning', info: 'bi bi-info-circle-fill text-info' };
    return map[dynamicType.value as keyof typeof map] || '';
});
const headerClass = computed(() => {
    const map = { success: 'bg-success text-white', error: 'bg-danger text-white', warning: 'bg-warning text-dark', info: 'bg-info text-white' };
    return map[dynamicType.value as keyof typeof map] || '';
});
const contentClass = computed(() => dynamicType.value ? `modal-${dynamicType.value}` : '');
const confirmButtonClass = computed(() => {
    const map = { success: 'btn-success', error: 'btn-danger', warning: 'btn-warning', info: 'btn-info' };
    return map[dynamicType.value as keyof typeof map] || 'btn-primary';
});

const emits = defineEmits(['onConfirm', 'onClose', 'onCancel', 'onHidden']);
const modalShow = ref(false);
const modalContainer = ref<HTMLElement>(null as any);
let modal: bootstrap.Modal | null = null;

function getModal() {
    if (modal) return modal;
    if (!modalContainer.value) return null;
    const m = new bootstrap.Modal(modalContainer.value, { backdrop: 'static', keyboard: false });
    modalContainer.value.addEventListener('hidden.bs.modal', () => { modalShow.value = false; emits('onHidden'); });
    modalContainer.value.addEventListener('show.bs.modal', () => { modalShow.value = true; });
    return m;
}

function show() {
    const m = getModal();
    if (m) { m.show(); return Promise.resolve(); }
    return Promise.resolve();
}

function hide() {
    const m = getModal();
    if (m) m.hide();
    return Promise.resolve();
}

function confirm() { emits('onConfirm'); dynamicOptions.value?.onConfirm?.(); }
function cancel() { hide(); emits('onCancel'); dynamicOptions.value?.onCancel?.(); }

watch(() => props.visible, (visible) => { visible ? show() : hide(); });
onMounted(() => { modal = getModal(); });
onUnmounted(() => { if (modal) modal.dispose(); });

defineExpose({
    show, open: show, hide, close: hide, modalId,
    setTitle: (t: string) => dynamicTitle.value = t,
    setContent: (c: string) => dynamicContent.value = c,
    setType: (t: 'success' | 'error' | 'warning' | 'info') => dynamicType.value = t,
    setConfirmText: (t: string) => dynamicConfirmText.value = t,
    setCancelText: (t: string) => dynamicCancelText.value = t,
    setShowCancel: (s: boolean) => dynamicShowCancel.value = s,
    setOptions: (options: any) => {
        if (options.title) dynamicTitle.value = options.title;
        if (options.content) dynamicContent.value = options.content;
        if (options.type) dynamicType.value = options.type;
        if (options.confirmText) dynamicConfirmText.value = options.confirmText;
        if (options.cancelText) dynamicCancelText.value = options.cancelText;
        if (options.showCancel !== undefined) dynamicShowCancel.value = options.showCancel;
        dynamicOptions.value = options;
    }
});
</script>

<style scoped>
.modal-dialog { z-index: var(--bs-modal-zindex); }
.modal-body { min-height: 80px; display: flex; flex-direction: column; align-items: stretch; }
</style>
