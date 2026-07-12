import {
  MessageCircle,
  FileText,
  Settings,
  Monitor,
} from 'lucide-vue-next';

export interface MenuItem {
  title: string;
  key: string;
  icon?: any;
  path: string;
  component?: string;
  children?: MenuItem[];
  // 是否在菜单中隐藏
  hiddenInMenu?: boolean;
}

// AI 相关菜单配置
export const aiMenus: MenuItem[] = [
  {
    title: '提问',
    key: 'ai-chat',
    icon: MessageCircle,
    path: '/ai/ai-chat',
    component: 'ai/ai-chat/index',
  },
  {
    title: '提示词模板',
    key: 'prompt-template',
    icon: FileText,
    path: '/ai/prompt-template',
    component: 'ai/prompt-template/index',
  },
];

// 系统设置菜单配置
export const systemMenus: MenuItem[] = [
  {
    title: '系统设置',
    key: 'app-setting',
    icon: Settings,
    path: '/system/app-setting',
    component: 'system/app-setting/index',
  },
];

export const dashboardMenus: MenuItem[] = [
  {
    title: '工作台',
    key: 'workspace',
    icon: Monitor,
    path: '/system/workspace',
    component: 'system/workspace/index',
  },
];
