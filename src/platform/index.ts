import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import i18n from '@/utils/i18n';

import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@/assets/main.css';
import 'bootstrap';

import toastPlugin from '@/components/toast/index';
import modalPlugin from '@/components/modal/index';

const app = createApp(App);
const pinia = createPinia();

app.use(router);
app.use(pinia);
app.use(i18n);
app.use(toastPlugin);
app.use(modalPlugin);

app.mount('#app');
