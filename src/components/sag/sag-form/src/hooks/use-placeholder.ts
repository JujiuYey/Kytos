import type { FieldType } from '@/components/sag/sag-form/types';

/**
 * 根据字段标签和类型生成占位符
 * @param label 字段标签
 * @param type 字段类型
 * @returns 生成的占位符文本
 */
export function usePlaceholder(label: string, type: FieldType): string {
  if (!label) {
    return '';
  }

  switch (type) {
    case 'text':
    case 'email':
    case 'password':
    case 'number':
    case 'tel':
    case 'url':
    case 'textarea':
      return `请输入${label}`;

    case 'select':
    case 'radio':
    case 'checkbox':
      return `请选择${label}`;

    case 'date':
      return `请选择${label}日期`;

    case 'datetime':
      return `请选择${label}日期时间`;

    case 'time':
      return `请选择${label}时间`;

    case 'file-upload':
    case 'avatar-upload':
      return `请上传${label}`;

    case 'tags-input':
      return `请添加${label}（按回车确认）`;

    case 'switch':
    default:
      return '';
  }
}
