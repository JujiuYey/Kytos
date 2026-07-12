import {
  FolderKanban,
  Component,
  FileInput,
  BarChart3,
  FilePieChart,
  MessageCircle,
  FileText,
  Settings,
  Home,
  Monitor,
  Link2,
  ListChecks,
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

// 基础菜单配置
export const basicMenus: MenuItem[] = [
  {
    title: '检测单位',
    key: 'test-unit',
    icon: Home,
    path: '/basic/test-unit',
    component: 'basic/test-unit/index',
  },
  {
    title: '部件权重',
    key: 'struct-component-weight',
    icon: Component,
    path: '/basic/struct-component-weight',
    component: 'basic/struct-component-weight/index',
  },
  {
    title: '评价标准',
    key: 'assessment-standards',
    icon: ListChecks,
    path: '/basic/assessment-standards',
    component: 'basic/assessment-standards/index',
  },
  {
    title: '项目管理',
    key: 'project',
    icon: FolderKanban,
    path: '/basic/project',
    component: 'basic/project/index',
  },
  {
    title: '桥梁信息',
    key: 'bridge',
    icon: Link2,
    path: '/basic/bridge',
    component: 'basic/bridge/index',
  },
];

// 报告相关菜单配置
export const reportMenus: MenuItem[] = [
  {
    title: '数据录入',
    key: 'data-entry',
    icon: FileInput,
    path: '/report/data-entry',
    component: 'report/data-entry/index',
  },
  {
    title: '评定分析',
    key: 'rating-analysis',
    icon: BarChart3,
    path: '/report/rating-analysis',
    component: 'report/rating-analysis/index',
  },
  {
    title: '报告生成',
    key: 'report-generation',
    icon: FilePieChart,
    path: '/report/report-generation',
    component: 'report/report-generation/index',
  },
];

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
