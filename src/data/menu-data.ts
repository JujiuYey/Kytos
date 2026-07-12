import type { Component } from 'vue';

export interface MenuItem {
  title: string;
  key: string;
  icon?: Component;
  path: string;
  component?: string;
  children?: MenuItem[];
  hiddenInMenu?: boolean;
}

export const gachaMenus: MenuItem[] = [];

export const systemMenus: MenuItem[] = [];
