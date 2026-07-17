import type { Component } from 'vue';
import { BookText, PenLine, Sparkles, User, Wand2 } from 'lucide-vue-next';

export interface MenuItem {
  title: string;
  key: string;
  icon: Component;
  path: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export const menuGroups: MenuGroup[] = [
  {
    label: '角色形象',
    items: [
      {
        title: '特征',
        key: 'character',
        icon: User,
        path: '/character',
      },
      {
        title: '初始',
        key: 'initial',
        icon: Wand2,
        path: '/initial',
      },
      {
        title: '策略',
        key: 'strategy',
        icon: BookText,
        path: '/strategy',
      },
    ],
  },
  {
    label: '创作',
    items: [
      {
        title: 'ip形象',
        key: 'writer',
        icon: PenLine,
        path: '/writer',
      },
      {
        title: '抽卡',
        key: 'gacha',
        icon: Sparkles,
        path: '/gacha',
      },
    ],
  },
];
