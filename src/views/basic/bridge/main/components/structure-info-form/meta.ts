import type { FormFields, FormConfig } from '@/components/sag/sag-form/types';

// D 桥梁结构信息
export const sectionD: FormFields = [
  {
    name: 'divider_d',
    type: 'divider',
    label: 'D 桥梁结构信息',
  },
  {
    name: 'span_arrangement',
    type: 'text',
    label: '桥梁跨径分孔（m）',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'structural_system',
    type: 'text',
    label: '结构体系',
    grid: { span: 1 },
  },
  {
    name: 'main_girder',
    type: 'text',
    label: '主梁（上部）',
    grid: { span: 1 },
  },
  {
    name: 'deck_pavement',
    type: 'text',
    label: '桥面铺装',
    grid: { span: 1 },
  },
  {
    name: 'main_bridge_form',
    type: 'text',
    label: '主桥涵形式与材料',
    grid: { span: 1 },
  },
  {
    name: 'expansion_joint',
    type: 'text',
    label: '伸缩缝形式与材料',
    grid: { span: 1 },
  },
  {
    name: 'sidewalk_curb',
    type: 'text',
    label: '人行道及路缘',
    grid: { span: 1 },
  },
  {
    name: 'railing',
    type: 'text',
    label: '栏杆及护栏',
    grid: { span: 1 },
  },
  {
    name: 'lighting_signs',
    type: 'text',
    label: '照明及标志',
    grid: { span: 1 },
  },
  {
    name: 'bearing',
    type: 'text',
    label: '支座形式与材料',
    grid: { span: 1 },
  },
  {
    name: 'collision_protection',
    type: 'text',
    label: '桥梁防撞设施',
    grid: { span: 1 },
  },
  {
    name: 'navigation_drainage',
    type: 'text',
    label: '航标及排水系统',
    grid: { span: 1 },
  },
  {
    name: 'abutment',
    type: 'text',
    label: '桥台（下部结构形式与材料）',
    grid: { span: 1 },
  },
  {
    name: 'pier',
    type: 'text',
    label: '桥墩',
    grid: { span: 1 },
  },
  {
    name: 'slope_protection',
    type: 'text',
    label: '锥坡及护坡',
    grid: { span: 1 },
  },
  {
    name: 'wing_wall',
    type: 'text',
    label: '翼墙及耳墙',
    grid: { span: 1 },
  },
  {
    name: 'training_structure',
    type: 'text',
    label: '调治构造物',
    grid: { span: 1 },
  },
  {
    name: 'foundation',
    type: 'text',
    label: '基础形式与材料',
    grid: { span: 1 },
  },
  {
    name: 'anchorage',
    type: 'text',
    label: '锚碇',
    grid: { span: 1 },
  },
];

export const formFields = [
  ...sectionD,
];

export const formConfig: FormConfig = {
  layout: {
    columns: 3,
    spacing: '1rem',
  },
};
