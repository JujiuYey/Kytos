import type { Component } from 'vue';
import { Sparkles, PenLine, User, BookText, Settings } from 'lucide-vue-next';

export interface MenuItem {
  title: string;
  key: string;
  group: string;
  icon?: Component;
  path: string;
  component?: string;
  hiddenInMenu?: boolean;
}

export const menus: MenuItem[] = [
  {
    title: '角色',
    key: 'writer',
    group: '创作',
    icon: PenLine,
    path: '/writer',
    component: 'writer/index',
  },
  {
    title: '抽卡',
    key: 'gacha',
    group: '创作',
    icon: Sparkles,
    path: '/gacha',
    component: 'gacha/index',
  },
  {
    title: '特征',
    key: 'character',
    group: '角色',
    icon: User,
    path: '/character',
    component: 'character/index',
  },
  {
    title: '策略',
    key: 'strategy',
    group: '角色',
    icon: BookText,
    path: '/strategy',
    component: 'strategy/index',
  },
  {
    title: '设置',
    key: 'settings',
    group: '系统',
    icon: Settings,
    path: '/settings',
    component: 'settings/index',
  },
];

/** Legacy exports — kept so existing imports keep working during the migration. */
export const gachaMenus = menus.filter(m => m.group === '创作');
export const writerMenus = menus.filter(m => m.group === '角色');
export const systemMenus = menus.filter(m => m.group === '系统');

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

/** Sidebar order: 创作 → 角色 → 系统. */
export const menuGroups: MenuGroup[] = (() => {
  const order = ['创作', '角色', '系统'];
  return order.map(label => ({
    label,
    items: menus.filter(m => m.group === label),
  }));
})();
