import type { Component } from 'vue';
import { Sparkles, Settings } from 'lucide-vue-next';

export interface MenuItem {
  title: string;
  key: string;
  icon?: Component;
  path: string;
  component?: string;
  children?: MenuItem[];
  hiddenInMenu?: boolean;
}

export const gachaMenus: MenuItem[] = [
  {
    title: '抽卡',
    key: 'gacha',
    icon: Sparkles,
    path: '/gacha',
    component: 'gacha/index',
  },
];

export const systemMenus: MenuItem[] = [
  {
    title: '设置',
    key: 'settings',
    icon: Settings,
    path: '/settings',
    component: 'settings/index',
  },
];
