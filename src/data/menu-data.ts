import type { Component } from 'vue';
import {
  BookMarked,
  BookOpen,
  Camera,
  ImagePlus,
  Images,
  Laugh,
  PersonStanding,
  Sparkles,
  UsersRound,
} from '@lucide/vue';

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
        key: 'character-create',
        icon: Sparkles,
        path: '/character-create',
      },
      {
        title: '角色管理',
        key: 'characters',
        icon: UsersRound,
        path: '/character',
      },
      {
        title: '角色锚点',
        key: 'character-anchor',
        icon: Camera,
        path: '/character-anchor',
      },
      {
        title: '角色动作',
        key: 'character-action',
        icon: PersonStanding,
        path: '/character-action',
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
        title: '插画创作 Beta',
        key: 'illustration-beta',
        icon: Sparkles,
        path: '/illustration-beta',
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
