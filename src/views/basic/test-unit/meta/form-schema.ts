import type { FormFields } from '@/components/sag/sag-form/types';

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
    label: '名称',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'address',
    type: 'text',
    label: '地址',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'contactPhone',
    type: 'text',
    label: '联系电话',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'fax',
    type: 'text',
    label: '传真',
    validation: 'required',
    grid: { span: 1 },
  },
  {
    name: 'postcode',
    type: 'text',
    label: '邮政编码',
    validation: 'required',
    grid: { span: 1 },
  },
];
