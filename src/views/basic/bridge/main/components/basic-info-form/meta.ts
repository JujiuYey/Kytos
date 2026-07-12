import type { FormFields, FormConfig } from '@/components/sag/sag-form/types';

// A 桥梁所处行政区划代码
export const sectionA: FormFields = [
  {
    name: 'divider_a',
    type: 'divider',
    label: 'A 桥梁所处行政区划代码',
  },
  {
    name: 'admin_code',
    type: 'text',
    label: '行政区划代码',
    placeholder: '例如：500116',
    validation: 'required',
    grid: { span: 1, newRow: true },
  },
];

// B 行政区划数据
export const sectionB: FormFields = [
  {
    name: 'divider_b',
    type: 'divider',
    label: 'B 行政识别数据',
  },

  // 第一行
  {
    name: 'route_code',
    type: 'text',
    label: '路线编号',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'route_name',
    type: 'text',
    label: '路线名称',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'route_level',
    type: 'select',
    label: '路线等级',
    validation: 'required',
    grid: { span: 1 },
    options: [
      { label: '高速公路', value: 'highway' },
      { label: '一级公路', value: 'level1' },
      { label: '二级公路', value: 'level2' },
      { label: '三级公路', value: 'level3' },
      { label: '四级公路', value: 'level4' },
    ],
  },

  // 第一行
  {
    name: 'bridge_number',
    type: 'text',
    label: '桥梁编号',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'bridge_name',
    type: 'text',
    label: '桥梁名称',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'bridge_stake',
    type: 'text',
    label: '桥位桩号',
    grid: { span: 1 },
  },

  // 第三行
  {
    name: 'function_type',
    type: 'select',
    label: '功能类型',
    grid: { span: 1 },
    options: [
      { label: '公路桥', value: 'highway_bridge' },
      { label: '铁路桥', value: 'railway_bridge' },
      { label: '人行桥', value: 'pedestrian_bridge' },
    ],
  },
  {
    name: 'crossed_road_name',
    type: 'text',
    label: '被跨越道路（通道）名称',
    grid: { span: 1 },
  },
  {
    name: 'crossed_road_stake',
    type: 'text',
    label: '被跨越道路（通道）桩号',
    grid: { span: 1 },
  },

  // 第四行
  {
    name: 'design_load',
    type: 'text',
    label: '设计荷载',
    grid: { span: 1 },
  },
  {
    name: 'bridge_slope',
    type: 'number',
    label: '桥梁坡度',
    grid: { span: 1 },
  },
  {
    name: 'curve_radius',
    type: 'number',
    label: '桥梁平曲线半径',
    grid: { span: 1 },
  },

  // 第五行
  {
    name: 'completion_date',
    type: 'date',
    label: '建成时间',
    grid: { span: 1 },
  },
  {
    name: 'design_unit',
    type: 'text',
    label: '设计单位',
    grid: { span: 1 },
  },
  {
    name: 'construction_unit',
    type: 'text',
    label: '施工单位',
    grid: { span: 1 },
  },

  // 第六行
  {
    name: 'supervision_unit',
    type: 'text',
    label: '监理单位',
    grid: { span: 1 },
  },
  {
    name: 'owner_unit',
    type: 'text',
    label: '业主单位',
    grid: { span: 1 },
  },
  {
    name: 'maintenance_unit',
    type: 'text',
    label: '管养单位',
    grid: { span: 1 },
  },
];

export const formFields = [
  ...sectionA,
  ...sectionB,
];

export const formConfig: FormConfig = {
  layout: {
    columns: 3,
    spacing: '1rem',
  },
};
