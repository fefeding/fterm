import { createRouter, createWebHistory } from 'vue-router';
import { useTitle } from '@vueuse/core';
import { abortAllPending } from '@/adapter/ajax';
import i18n from '@/utils/i18n';

export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/:pathMatch(.*)*',
            name: 'terminal',
            component: () => import('@/views/index.vue'),
            meta: { titleKey: 'app.title' }
        },
    ],
});

router.beforeEach((_to, _from, next) => {
    abortAllPending();
    next();
});

router.afterEach((to) => {
    if (to.meta?.titleKey) {
        useTitle(i18n.global.t(to.meta.titleKey as string));
    } else if (to.meta?.title) {
        useTitle(to.meta.title as string);
    }
});

export default router;
