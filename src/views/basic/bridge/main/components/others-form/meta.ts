import type { FormFields, FormConfig } from '@/components/sag/sag-form/types';

// H 需要说明的事项
export const sectionH: FormFields = [
  {
    name: 'divider_h',
    type: 'divider',
    label: 'H 需要说明的事项',
  },
  {
    name: 'remarks',
    type: 'textarea',
    label: '需要说明的事项（含桥梁管养单位的变更情况）',
    grid: { span: 3 },
  },
];

// I 其他
export const sectionI: FormFields = [
  {
    name: 'divider_i',
    type: 'divider',
    label: 'I 其他',
  },
  {
    name: 'overall_photo',
    type: 'file-upload',
    label: '桥梁总体照片',
    grid: { span: 1 },
  },
  {
    name: 'front_photo',
    type: 'file-upload',
    label: '桥梁正面照片',
    grid: { span: 1 },
  },
  {
    name: 'bridge_engineer',
    type: 'text',
    label: '桥梁工程师',
    grid: { span: 1, newRow: true },
  },
  {
    name: 'filled_by',
    type: 'text',
    label: '填卡人',
    grid: { span: 1 },
  },
  {
    name: 'filled_date',
    type: 'date',
    label: '填卡日期',
    grid: { span: 1 },
  },
];

export const formFields = [
  ...sectionH,
  ...sectionI,
];

export const formConfig: FormConfig = {
  layout: {
    columns: 3,
    spacing: '1rem',
  },
};
