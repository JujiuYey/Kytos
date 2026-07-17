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
        redirect: '/gacha',
      },
      {
        path: '/settings',
        name: 'settings',
        component: () => import('@/views/settings/index.vue'),
      },
      {
        path: '/writer',
        name: 'writer',
        component: () => import('@/views/writer/index.vue'),
        meta: { title: 'ip形象' },
      },
      {
        path: '/gacha',
        name: 'gacha',
        component: () => import('@/views/gacha/index.vue'),
        meta: { title: '抽卡' },
      },
      {
        path: '/initial',
        name: 'initial',
        component: () => import('@/views/initial/index.vue'),
        meta: { title: '初始' },
      },
      {
        path: '/character',
        name: 'character',
        component: () => import('@/views/character/index.vue'),
        meta: { title: '特征' },
      },
      {
        path: '/strategy',
        name: 'strategy',
        component: () => import('@/views/strategy/index.vue'),
        meta: { title: '策略' },
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
