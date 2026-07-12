import type { FormFields } from '@/components/sag/sag-form/types';

export type FormMode = 'create' | 'edit';
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface Props {
  /**
   * 对话框标题
   */
  title: string;
  /**
   * 是否打开
   */
  open: boolean;
  /**
   * 模式
   */
  mode: FormMode;
  /**
   * 表单数据
   */
  formData: Recordable | null;
  /**
   * 字段配置
   */
  fields: FormFields;
  /**
   * 创建
   */
  createFunction: (values: any) => Promise<void>;
  /**
   * 更新
   */
  updateFunction: (values: any) => Promise<void>;
  /**
   * 对话框尺寸
   */
  size?: DialogSize;

}
