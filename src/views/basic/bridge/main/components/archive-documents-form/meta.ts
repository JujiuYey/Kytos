import type { FormFields, FormConfig } from '@/components/sag/sag-form/types';

// E 桥梁档案资料
export const sectionE: FormFields = [
  {
    name: 'divider_e',
    type: 'divider',
    label: 'E 桥梁档案资料',
  },
  {
    name: 'design_drawings',
    type: 'file-upload',
    label: '设计图纸',
    grid: { span: 1 },
  },
  {
    name: 'design_documents',
    type: 'file-upload',
    label: '设计文件',
    grid: { span: 1 },
  },
  {
    name: 'completion_drawings',
    type: 'file-upload',
    label: '竣工图纸',
    grid: { span: 1 },
  },
  {
    name: 'completion_documents',
    type: 'file-upload',
    label: '竣工文件（含施工原始记录）',
    grid: { span: 1 },
  },
  {
    name: 'acceptance_documents',
    type: 'file-upload',
    label: '验收文件',
    grid: { span: 1 },
  },
  {
    name: 'approval_documents',
    type: 'file-upload',
    label: '行政审批文件',
    grid: { span: 1 },
  },
  {
    name: 'regular_inspection',
    type: 'file-upload',
    label: '定期检查资料',
    grid: { span: 1 },
  },
  {
    name: 'special_inspection',
    type: 'file-upload',
    label: '特殊检查资料',
    grid: { span: 1 },
  },
  {
    name: 'maintenance_records',
    type: 'file-upload',
    label: '历次维修加固资料',
    grid: { span: 1 },
  },
  {
    name: 'other_archives',
    type: 'file-upload',
    label: '其他档案',
    grid: { span: 1 },
  },
  {
    name: 'document_type',
    type: 'text',
    label: '档案形式',
    grid: { span: 1, newRow: true },
  },
  {
    name: 'construction_date',
    type: 'text',
    label: '建桥时间（年/月）',
    grid: { span: 1 },
  },
];
export const formFields = [
  ...sectionE,
];

export const formConfig: FormConfig = {
  layout: {
    columns: 3,
    spacing: '1rem',
  },
};
