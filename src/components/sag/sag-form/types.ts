import type { AcceptableValue } from 'reka-ui';

// 字段类型枚举
export type FieldType
  = | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'tel'
    | 'url'
    | 'textarea'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'switch'
    | 'date'
    | 'datetime'
    | 'time'
    | 'file-upload'
    | 'tags-input'
    | 'divider';

// 选择项类型
export interface SelectOption {
  /**
   * 标签
   */
  label: string;
  /**
   * 值
   */
  value: AcceptableValue;
  /**
   * 图标
   */
  icon?: string;
  /**
   * 是否禁用
   */
  disabled?: boolean;
}

// 表单字段配置
export interface FormField {
  /**
   * 字段名称
   */
  name: string;
  /**
   * 字段类型
   */
  type: FieldType;
  /**
   * 字段标签
   */
  label: string;
  /**
   * 字段占位符
   */
  placeholder?: string;
  /**
   * 是否可见
   */
  visible?: boolean;
  /**
   * 是否禁用
   */
  disabled?: boolean;
  /**
   * 是否只读
   */
  readonly?: boolean;
  /**
   * 帮助文本
   */
  helpText?: string;
  /**
   * 验证规则
   */
  validation?: string | ((value: any) => boolean | string | Promise<boolean | string>);
  /**
   * 选项（支持同步数组或异步函数）
   */
  options?: SelectOption[] | (() => Promise<SelectOption[]>);
  /**
   * 属性
   */
  props?: Recordable;
  /**
   * 栅格布局
   */
  grid?: {
    cols?: number;
    span?: number;
    newRow?: boolean;
  };
  /**
   * 条件渲染
   */
  conditional?: {
    field: string;
    value: any;
    operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn';
  };
}

// 表单配置
export interface FormConfig {
  /**
   * 布局配置
   */
  layout?: {
    columns?: number;
    spacing?: string;
  };
  /**
   * 提交按钮配置
   */
  submitButton?: {
    text?: string;
    show?: boolean;
  };
  /**
   * 重置按钮配置
   */
  resetButton?: {
    text?: string;
    show?: boolean;
  };
}

// 表单 Schema 类型
export type FormFields = FormField[];

/**
 * 表单属性
 */
export interface FormProps {
  /**
   * 表单 schema
   */
  fields: FormFields;
  /**
   * 表单配置（布局、按钮等）
   */
  config?: FormConfig;
  /**
   * 初始值
   */
  initialValues?: Recordable;
  /**
   * 提交按钮加载状态
   */
  loading?: boolean;
}
