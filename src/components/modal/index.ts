import { createApp, getCurrentInstance, nextTick } from 'vue';
import BootstrapModal from './index.vue';

export type ModalType = { show: () => void; hide: () => void; open: () => void; close: () => void; };

const modalMethods = {
  alert: {} as (options: ModalOptions | string) => Promise<boolean>,
  confirm: {} as (options: ModalOptions | string) => Promise<boolean>,
  success: {} as (content: string) => Promise<boolean>,
  error: {} as (content: string, details?: any) => Promise<boolean>,
  warning: {} as (content: string) => Promise<boolean>,
  info: {} as (content: string) => Promise<boolean>,
  showModal: {} as (options: ModalOptions) => Promise<boolean>
};

export type ModalTypeWithMethods = ModalType & typeof modalMethods;

export type ModalOptions = {
  title?: string; content?: string; type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string; cancelText?: string; showCancel?: boolean; details?: any;
  onConfirm?: () => void; onCancel?: () => void;
};

let globalModalInstance: any = null;
let modalInstance: ModalTypeWithMethods;

export default {
  install(app: any) {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const modalApp = createApp(BootstrapModal);
    globalModalInstance = modalApp.mount(mount) as any;

    app.config.globalProperties.$modal = modalInstance = {
      show: () => globalModalInstance.show(),
      hide: () => globalModalInstance.hide(),
      open: () => globalModalInstance.show(),
      close: () => globalModalInstance.hide(),
      alert(options: ModalOptions | string) {
        const opts = typeof options === 'string' ? { content: options, type: 'info' as const, showCancel: false } : { ...options, showCancel: false };
        return showModal(opts);
      },
      confirm(options: ModalOptions | string) {
        const opts = typeof options === 'string' ? { content: options, type: 'warning' as const } : { ...options, showCancel: true };
        return showModal(opts);
      },
      success(content: string) { return this.alert({ content, type: 'success' as const }); },
      error(content: string, details?: any) { return this.alert({ content, type: 'error' as const, details }); },
      warning(content: string) { return this.alert({ content, type: 'warning' as const }); },
      info(content: string) { return this.alert({ content, type: 'info' as const }); },
    } as ModalTypeWithMethods;
  },
  get() {
    const instance = getCurrentInstance();
    if (!instance) return null;
    // @ts-ignore
    return instance.appContext.config?.globalProperties?.$modal as ModalTypeWithMethods;
  }
};

export const getModalInstance = (): ModalTypeWithMethods => modalInstance;

export const showModal = (options: ModalOptions): Promise<boolean> => {
  if (!globalModalInstance) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const finalOptions = {
      title: '提示', confirmText: '确定', cancelText: '取消', showCancel: false, type: 'info', ...options,
      onConfirm: () => { options.onConfirm?.(); globalModalInstance.hide(); nextTick(() => resolve(true)); },
      onCancel: () => { options.onCancel?.(); globalModalInstance.hide(); nextTick(() => resolve(false)); }
    };
    globalModalInstance.setOptions?.(finalOptions);
    globalModalInstance.show?.();
  });
};

export const showAlert = (content: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', details?: any) => {
  return showModal({ content, type, showCancel: false, details });
};

export const showConfirm = (content: string, options?: Omit<ModalOptions, 'content' | 'showCancel'>) => {
  return showModal({ title: '确认', content, type: 'warning', showCancel: true, ...options });
};
