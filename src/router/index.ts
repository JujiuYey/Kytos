import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw, RouteComponent } from 'vue-router';
import type { Component } from 'vue';
import Layout from '@/layout/index.vue';
import { dashboardMenus, aiMenus, systemMenus } from '@/data/menu-data';
import type { MenuItem } from '@/data/menu-data';

type LazyComponent = () => Promise<RouteComponent>;

// 动态导入组件的辅助函数
function dynamicImport(componentPath: string): LazyComponent {
  // 将路径中的反斜杠替换为正斜杠
  const normalizedPath = componentPath.replace(/\\/g, '/');
  // 确保路径以 .vue 结尾
  const pathWithExtension = normalizedPath.endsWith('.vue')
    ? normalizedPath
    : `${normalizedPath}.vue`;

  // 使用 import.meta.glob 来动态导入组件
  const modules = import.meta.glob('@/views/**/*.vue');

  // 查找匹配的模块
  const moduleKey = Object.keys(modules).find(key => {
    const normalizedKey = key.replace(/\\/g, '/');
    return normalizedKey.endsWith(pathWithExtension);
  });

  if (!moduleKey) {
    console.error(`Component not found: ${pathWithExtension}`);
    return () => Promise.reject(new Error(`Component ${pathWithExtension} not found`));
  }

  return modules[moduleKey] as LazyComponent;
}

// 将菜单数据转换为路由配置
function generateRoutes(menus: MenuItem[], parentPath = ''): RouteRecordRaw[] {
  return menus.flatMap(menu => {
    // 处理路径，确保不以斜杠结尾
    const normalizedParentPath = parentPath.endsWith('/')
      ? parentPath.slice(0, -1)
      : parentPath;

    const routePath = menu.path.startsWith('/')
      ? menu.path
      : `${normalizedParentPath}/${menu.path}`;

    const route: RouteRecordRaw = {
      path: routePath,
      name: menu.key,
      meta: {
        title: menu.title,
        icon: menu.icon,
        hiddenInMenu: menu.hiddenInMenu,
      },
      // 初始化为 undefined，稍后设置
      component: undefined as unknown as Component,
    };

    // 如果有组件路径，则动态导入组件
    if (menu.component) {
      try {
        const component = dynamicImport(menu.component);
        if (component) {
          route.component = component;
        } else {
          console.error(`Component not found: ${menu.component}`);
          route.component = () => Promise.reject(new Error(`Component ${menu.component} not found`));
        }
      } catch (error) {
        console.error(`Failed to load component: ${menu.component}`, error);
        route.component = () => Promise.reject(error);
      }
    }

    // 处理子路由
    const childRoutes = menu.children ? generateRoutes(menu.children, routePath) : [];

    // 如果没有组件但有子路由，则返回子路由
    if (!route.component && childRoutes.length > 0) {
      return childRoutes;
    }

    // 否则返回当前路由和子路由
    return [route, ...childRoutes];
  });
}

// 合并所有菜单
const allMenus = [...dashboardMenus, ...aiMenus, ...systemMenus];

// 生成路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/system/workspace',
    children: [
      // 首页重定向
      {
        path: '',
        redirect: '/system/workspace',
      },
      // 自动生成的路由
      ...generateRoutes(allMenus),
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/errors/404.vue'),
  },
];

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
