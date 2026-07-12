import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw, RouteComponent } from 'vue-router';
import type { Component } from 'vue';
import Layout from '@/layout/index.vue';
import { gachaMenus, systemMenus } from '@/data/menu-data';
import type { MenuItem } from '@/data/menu-data';

type LazyComponent = () => Promise<RouteComponent>;

function dynamicImport(componentPath: string): LazyComponent {
  const normalizedPath = componentPath.replace(/\\/g, '/');
  const pathWithExtension = normalizedPath.endsWith('.vue')
    ? normalizedPath
    : `${normalizedPath}.vue`;

  const modules = import.meta.glob('@/views/**/*.vue');

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

function generateRoutes(menus: MenuItem[], parentPath = ''): RouteRecordRaw[] {
  return menus.flatMap(menu => {
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
      component: undefined as unknown as Component,
    };

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

    const childRoutes = menu.children ? generateRoutes(menu.children, routePath) : [];

    if (!route.component && childRoutes.length > 0) {
      return childRoutes;
    }

    return [route, ...childRoutes];
  });
}

const allMenus = [...gachaMenus, ...systemMenus];

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    children: [
      ...generateRoutes(allMenus),
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
