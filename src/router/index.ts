import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';
import { useAppStore } from '@/stores/app';

const routes: RouteRecordRaw[] = [
  {
    path: '/setup',
    name: 'setup',
    component: () => import('@/views/setup/index.vue'),
  },
  {
    path: '/',
    component: Layout,
    redirect: '/character',
    children: [
      {
        path: '/settings',
        name: 'settings',
        component: () => import('@/views/settings/index.vue'),
      },
      {
        path: '/character',
        name: 'character',
        component: () => import('@/views/character/index.vue'),
        meta: { title: '特征' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/errors/404.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(to => {
  const appStore = useAppStore();
  if (!appStore.isWorkspaceConfigured && to.name !== 'setup') {
    return { name: 'setup' };
  }
  if (appStore.isWorkspaceConfigured && to.name === 'setup') {
    return { name: 'character' };
  }
  return true;
});

export default router;
