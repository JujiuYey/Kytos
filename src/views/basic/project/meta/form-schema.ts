import type { FormFields, FormConfig } from '@/components/sag/sag-form/types';

// 状态选项
const statusOptions = [
  { label: '待开始', value: 'pending' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
];

// 基础字段配置
export const formFields: FormFields = [
  {
    name: 'id',
    type: 'text',
    label: 'ID',
    placeholder: '项目ID',
    grid: { span: 2 },
    visible: false,
  },
  {
    name: 'name',
    type: 'text',
    label: '项目名称',
    validation: 'required',
    grid: { span: 2 },
  },
  {
    name: 'leader',
    type: 'text',
    label: '负责人',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'status',
    type: 'select',
    label: '状态',
    options: statusOptions,
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'report_writer',
    type: 'text',
    label: '报告编写',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'report_reviewer',
    type: 'text',
    label: '报告审核',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'report_signer',
    type: 'text',
    label: '报告签发',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'entrust_unit_name',
    type: 'text',
    label: '委托单位名称',
    validation: 'required',
    grid: { span: 1, newRow: true },
  },
  {
    name: 'entrust_unit_address',
    type: 'text',
    label: '委托单位地址',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'entrust_unit_phone',
    type: 'text',
    label: '委托单位联系电话',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'entrust_date',
    type: 'date',
    label: '委托日期',
    validation: 'required',
    grid: { span: 1 },
  },
];

// 基础表单配置
export const formConfig: FormConfig = {
  layout: {
    columns: 2,
    spacing: 'space-y-4',
  },
  submitButton: {
    text: '保存',
    show: true,
  },
  resetButton: {
    text: '重置',
    show: true,
  },
};
