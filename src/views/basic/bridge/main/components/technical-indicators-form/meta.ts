import type { FormFields, FormConfig } from '@/components/sag/sag-form/types';

// C 桥梁技术指标
export const sectionC: FormFields = [
  {
    name: 'divider_c',
    type: 'divider',
    label: 'C 桥梁技术指标',
  },

  // 第一行
  {
    name: 'total_length',
    type: 'number',
    label: '桥梁全长 (m)',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'total_width',
    type: 'number',
    label: '桥面总宽 (m)',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'lane_width',
    type: 'number',
    label: '车道宽度 (m)',
    grid: { span: 1 },
  },

  // 第二行
  {
    name: 'sidewalk_width',
    type: 'number',
    label: '人行道宽度 (m)',
    grid: { span: 1 },
  },
  {
    name: 'barrier_height',
    type: 'number',
    label: '护栏或防撞墙高度 (m)',
    grid: { span: 1 },
  },
  {
    name: 'median_width',
    type: 'number',
    label: '中央分隔带宽度 (m)',
    grid: { span: 1 },
  },

  // 第三行
  {
    name: 'standard_clearance',
    type: 'number',
    label: '桥面标准净空 (m)',
    grid: { span: 1 },
  },
  {
    name: 'actual_clearance',
    type: 'number',
    label: '桥面实际净空 (m)',
    grid: { span: 1 },
  },
  {
    name: 'navigation_clearance',
    type: 'number',
    label: '桥下通航海轮及标准净空 (m)',
    grid: { span: 1 },
  },

  // 第四行
  {
    name: 'actual_under_clearance',
    type: 'number',
    label: '桥下实际净空 (m)',
    grid: { span: 1 },
  },
  {
    name: 'approach_width',
    type: 'number',
    label: '引道总宽 (m)',
    grid: { span: 1 },
  },
  {
    name: 'approach_curve_radius',
    type: 'number',
    label: '引道线形或曲线半径 (m)',
    grid: { span: 1 },
  },

  // 第五行
  {
    name: 'design_flood_frequency',
    type: 'text',
    label: '设计洪水频率及其水位',
    grid: { span: 1 },
  },
  {
    name: 'historical_flood_level',
    type: 'number',
    label: '历史洪水位',
    grid: { span: 1 },
  },
  {
    name: 'seismic_coefficient',
    type: 'number',
    label: '设计地震动峰值加速度系数',
    grid: { span: 1 },
  },

  // 第六行
  {
    name: 'deck_elevation',
    type: 'number',
    label: '桥面高程（m）',
    grid: { span: 1 },
  },
];

export const formFields = [
  ...sectionC,
];

export const formConfig: FormConfig = {
  layout: {
    columns: 3,
    spacing: '1rem',
  },
};
