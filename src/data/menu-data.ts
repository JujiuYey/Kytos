import type { Component } from 'vue';
import { BookMarked, BookOpen, ImagePlus, Images, UsersRound } from 'lucide-vue-next';

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
        title: '角色管理',
        key: 'characters',
        icon: UsersRound,
        path: '/characters',
      },
    ],
  },
  {
    label: '创作',
    items: [
      {
        title: '插画管理',
        key: 'illustration-library',
        icon: Images,
        path: '/illustration-library',
      },
      {
        title: '插画创作',
        key: 'illustration',
        icon: ImagePlus,
        path: '/illustration',
      },
      {
        title: '故事管理',
        key: 'stories',
        icon: BookMarked,
        path: '/stories',
      },
      {
        title: '故事创作',
        key: 'story',
        icon: BookOpen,
        path: '/story',
      },
    ],
  },
];
