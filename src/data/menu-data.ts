import type { Component } from 'vue';
// import { BookText, PenLine, Sparkles, User, Wand2 } from 'lucide-vue-next';
import { Camera, Laugh, User } from 'lucide-vue-next';

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
        title: '创建角色',
        key: 'character',
        icon: User,
        path: '/character',
      },
      {
        title: '角色视觉',
        key: 'character-portrait',
        icon: Camera,
        path: '/character-portrait',
      },
      {
        title: '表情管理',
        key: 'character-expression',
        icon: Laugh,
        path: '/character-expression',
      },
    ],
  },
  // {
  //   label: '创作',
  //   items: [
  //     {
  //       title: 'ip形象',
  //       key: 'writer',
  //       icon: PenLine,
  //       path: '/writer',
  //     },
  //     {
  //       title: '抽卡',
  //       key: 'gacha',
  //       icon: Sparkles,
  //       path: '/gacha',
  //     },
  //   ],
  // },
];
