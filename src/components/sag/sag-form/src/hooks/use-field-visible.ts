import type { FormField } from '@/components/sag/sag-form/types';
import type { Reactive } from 'vue';

export function useFieldVisible(formData: Reactive<Recordable>) {
  // 处理字段可见性
  function isFieldVisible(field: FormField) {
    // 如果字段显式设置为不可见，则直接返回 false
    if (field.visible === false) {
      return false;
    }

    // 如果没有条件，则根据 visible 属性决定可见性
    if (!field.conditional) {
      return field.visible ?? true;
    }

    const { field: dependentField, value, operator = 'eq' } = field.conditional;
    const dependentValue = formData[dependentField];

    // 处理条件可见性
    switch (operator) {
      case 'eq':
        return dependentValue === value;
      case 'ne':
        return dependentValue !== value;
      case 'gt':
        return dependentValue > value;
      case 'lt':
        return dependentValue < value;
      case 'gte':
        return dependentValue >= value;
      case 'lte':
        return dependentValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(dependentValue);
      case 'notIn':
        return Array.isArray(value) && !value.includes(dependentValue);
      default:
        return field.visible ?? true;
    }
  }

  return {
    isFieldVisible,
  };
}
