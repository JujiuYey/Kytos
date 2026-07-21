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
        path: '/setting',
        name: 'setting',
        component: () => import('@/views/setting/index.vue'),
      },
      {
        path: '/character',
        name: 'character',
        component: () => import('@/views/character/index.vue'),
        meta: { title: '角色管理' },
      },
      {
        path: '/character-create',
        name: 'character-create',
        component: () => import('@/views/character-create/index.vue'),
        meta: { title: '创建角色' },
      },
      {
        path: '/character',
        name: 'character',
        redirect: { name: 'character-create' },
      },
      {
        path: '/character-portrait',
        name: 'character-portrait',
        component: () => import('@/views/character-portrait/index.vue'),
        meta: { title: '角色视觉' },
      },
      {
        path: '/character-expression',
        name: 'character-expression',
        component: () => import('@/views/character-expression/index.vue'),
        meta: { title: '表情管理' },
      },
      {
        path: '/illustration',
        name: 'illustration',
        component: () => import('@/views/illustration/index.vue'),
        meta: { title: '插画创作' },
      },
      {
        path: '/illustration-beta',
        name: 'illustration-beta',
        component: () => import('@/views/illustration-beta/index.vue'),
        meta: { title: '插画创作 Beta' },
      },
      {
        path: '/illustration-library',
        name: 'illustration-library',
        component: () => import('@/views/illustration-library/index.vue'),
        meta: { title: '插画管理' },
      },
      {
        path: '/stories',
        name: 'stories',
        component: () => import('@/views/stories/index.vue'),
        meta: { title: '故事管理' },
      },
      {
        path: '/story',
        name: 'story',
        component: () => import('@/views/story/index.vue'),
        meta: { title: '故事创作' },
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
    return { name: 'characters' };
  }
  return true;
});

export default router;
