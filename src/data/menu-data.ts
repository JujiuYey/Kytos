import type { Component } from 'vue';
import { Sparkles, PenLine, User, BookText, Settings, Wand2 } from 'lucide-vue-next';

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
    title: 'ip形象',
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
    title: '初始',
    key: 'initial',
    group: 'ip形象',
    icon: Wand2,
    path: '/initial',
    component: 'initial/index',
  },
  {
    title: '特征',
    key: 'character',
    group: 'ip形象',
    icon: User,
    path: '/character',
    component: 'character/index',
  },
  {
    title: '策略',
    key: 'strategy',
    group: 'ip形象',
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
export const writerMenus = menus.filter(m => m.group === 'ip形象');
export const systemMenus = menus.filter(m => m.group === '系统');

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

/** Sidebar order: 创作 → ip形象 → 系统. */
export const menuGroups: MenuGroup[] = (() => {
  const order = ['创作', 'ip形象', '系统'];
  return order.map(label => ({
    label,
    items: menus.filter(m => m.group === label),
  }));
})();
