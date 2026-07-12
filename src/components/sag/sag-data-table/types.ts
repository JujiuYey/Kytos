// 列配置类型
export interface TableColumn<T = any> {
  // 列的唯一标识
  key: string;
  // 列标题
  label: string;
  // 列宽度
  width?: string;
  // 对齐方式
  align?: 'left' | 'center' | 'right';
  // 是否可排序
  sortable?: boolean;
  // 自定义渲染函数
  render?: (row: T, value: any) => any;
  // 列类型（用于预设渲染）
  type?: 'text' | 'avatar' | 'badge' | 'date' | 'actions';
  // Badge 类型的配置
  badgeMap?: Record<string | number, { text: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' }>;
  // 枚举映射（用于转换值）
  enumMap?: Record<string | number, string>;
  // 操作按钮配置
  actions?: Array<{
    label: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    onClick: (row: T) => void;
  }>;
  // 头像配置
  avatarConfig?: {
    srcKey: string;
    fallbackKey?: string;
  };
}
