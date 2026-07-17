import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/gacha',
    children: [
      {
        path: '',
        redirect: '/settings',
      },
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
    component: () => import('@/pages/errors/404.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
