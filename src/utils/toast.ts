import { getCurrentInstance } from 'vue';

export type ToastType = {
  show: (title: string, message: string, type: string, duration?: number) => void,
  success: (msg: string, title?: string, duration?: number) => void,
  error: (msg: string, title?: string, duration?: number) => void,
  warning: (msg: string, title?: string, duration?: number) => void,
  info: (msg: string, title?: string, duration?: number) => void
};

let globalToast: ToastType | null = null;

export function setGlobalToast(toast: ToastType) {
  globalToast = toast;
}

export class ToastHelper {
  private getToast(): ToastType | null {
    if (globalToast) return globalToast;
    const instance = getCurrentInstance();
    if (!instance) return null;
    return instance.appContext.config?.globalProperties?.$toast as ToastType || null;
  }

  success(message: string, title = '', duration = 3000): void {
    this.getToast()?.success(message, title, duration);
  }

  error(message: string, title = '', duration = 3000): void {
    this.getToast()?.error(message, title, duration);
  }

  warning(message: string, title = '', duration = 3000): void {
    this.getToast()?.warning(message, title, duration);
  }

  info(message: string, title = '', duration = 3000): void {
    this.getToast()?.info(message, title, duration);
  }
}

export const toast = new ToastHelper();
