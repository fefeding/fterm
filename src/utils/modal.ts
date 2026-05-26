import { getCurrentInstance } from 'vue';
import { getModalInstance, showAlert, showConfirm, type ModalTypeWithMethods } from '@/components/modal';

export class ModalHelper {
  private getModal(): ModalTypeWithMethods | null {
    const instance = getModalInstance();
    return instance || null;
  }

  success(content: string): Promise<boolean> {
    return this.getModal()?.success(content) || showAlert(content, 'success') || Promise.resolve(true);
  }

  error(content: string | Error, detail?: any): Promise<boolean> {
    const msg = content instanceof Error ? content.message : String(content);
    return this.getModal()?.error(msg, detail) || showAlert(msg, 'error', detail) || Promise.resolve(true);
  }

  warning(content: string): Promise<boolean> {
    return this.getModal()?.warning(content) || showAlert(content, 'warning') || Promise.resolve(true);
  }

  info(content: string): Promise<boolean> {
    return this.getModal()?.info(content) || showAlert(content, 'info') || Promise.resolve(true);
  }

  alert(content: string): Promise<boolean> {
    return this.getModal()?.alert(content) || showAlert(content, 'info') || Promise.resolve(true);
  }

  confirm(content: string, options?: { title?: string; onConfirm?: () => void; onCancel?: () => void }): Promise<boolean> {
    return this.getModal()?.confirm({ ...options, content }) || showConfirm(content, options) || Promise.resolve(false);
  }
}

export const modal = new ModalHelper();
