import { createI18n } from 'vue-i18n';
import zhCN from '@/locales/zh-CN';
import enUS from '@/locales/en-US';

const savedLocale = localStorage.getItem('fterm-locale') || 'en-US';

const i18n = createI18n({
  locale: savedLocale,
  fallbackLocale: 'en-US',
  legacy: false,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

export function setLocale(locale: 'zh-CN' | 'en-US') {
  i18n.global.locale.value = locale as any;
  localStorage.setItem('fterm-locale', locale);
}

export function getLocale() {
  return i18n.global.locale.value;
}

export default i18n;
