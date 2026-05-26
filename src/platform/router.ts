import { createRouter, createWebHistory } from 'vue-router';
import { useTitle } from '@vueuse/core';
import { abortAllPending } from '@/adapter/ajax';

export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'terminal',
            component: () => import('@/views/index.vue'),
            meta: { title: 'fterm - 远程终端' }
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'not-found',
            redirect: '/',
        },
    ],
});

router.beforeEach((_to, _from, next) => {
    abortAllPending();
    next();
});

router.afterEach((to) => {
    if (to.meta?.title) {
        useTitle(to.meta.title as string);
    }
});

export default router;
