import type { Component } from 'vue';
import { Camera, ImagePlus, Images, Laugh, User } from 'lucide-vue-next';

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
  {
    label: '创作',
    items: [
      {
        title: '插画创作',
        key: 'illustration',
        icon: ImagePlus,
        path: '/illustration',
      },
      {
        title: '插画管理',
        key: 'illustration-library',
        icon: Images,
        path: '/illustration-library',
      },
    ],
  },
];
