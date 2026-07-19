import type { FormProps, FormField } from '@/components/sag/sag-form/types';
import { computed } from 'vue';

export function useFormLayout(props: FormProps) {
  // 获取总列数
  const columns = computed(() => props.config?.layout?.columns || 2);

  // 计算容器的 grid 样式（返回样式对象）
  const gridStyle = computed(() => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))`,
    gap: '1rem',
  }));

  // 计算字段的 grid 样式
  function getFieldGridStyle(field: FormField) {
    // 如果字段不可见，则隐藏
    if (field.visible === false) {
      return { display: 'none' };
    }

    // 分割线类型占满整行
    if (field.type === 'divider') {
      return { gridColumn: '1 / -1' };
    }

    // 获取字段跨列数，默认为 1
    const span = field.grid?.span || 1;
    const newRow = field.grid?.newRow || false;

    const style: any = {};

    // 如果设置了强制换行，从第1列开始
    if (newRow) {
      style.gridColumnStart = '1';
    }

    // 如果跨列数 >= 总列数，占满整行
    if (span >= columns.value) {
      style.gridColumn = '1 / -1';
    } else {
      // 如果已经设置了 gridColumnStart，只设置 span
      if (newRow) {
        style.gridColumn = `1 / span ${span}`;
      } else {
        style.gridColumn = `span ${span}`;
      }
    }

    return style;
  }

  return {
    gridStyle,
    getFieldGridStyle,
  };
}
