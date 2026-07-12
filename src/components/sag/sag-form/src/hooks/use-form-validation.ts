import type { FormProps, FormField } from '@/components/sag/sag-form/types';

type ValidationRuleParams = Record<string, any> | any[] | string | number | boolean;
type ValidationRuleFunction = (value: any, params?: any, formData?: Record<string, any>) => boolean | string;

// 导出类型供外部使用
export type { ValidationRuleFunction, ValidationRuleParams };

export interface ValidationRule {
  name: string;
  validate: ValidationRuleFunction;
  message: string | ((field: string, params?: ValidationRuleParams) => string);
}

// 内置验证规则
const builtInRules: Record<string, ValidationRule> = {
  required: {
    name: 'required',
    validate: (value: any) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return true;
    },
    message: (field: string) => `${field} 是必填项`,
  },
  email: {
    name: 'email',
    validate: (value: string) => {
      if (!value) {
        return true;
      }
      // 非必填字段可以为空
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
    message: (field: string) => `${field} 格式不正确`,
  },
  min: {
    name: 'min',
    validate: (value: string | any[], min: number) => {
      if (!value) {
        return true;
      }
      if (Array.isArray(value)) {
        return value.length >= min;
      }
      if (typeof value === 'string') {
        return value.length >= min;
      }
      if (typeof value === 'number') {
        return value >= min;
      }
      return false;
    },
    message: (field: string, params: any) => `${field} 不能少于 ${params} 个字符`,
  },
  max: {
    name: 'max',
    validate: (value: string | any[], max: number) => {
      if (!value) {
        return true;
      }
      if (Array.isArray(value)) {
        return value.length <= max;
      }
      if (typeof value === 'string') {
        return value.length <= max;
      }
      if (typeof value === 'number') {
        return value <= max;
      }
      return false;
    },
    message: (field: string, params: any) => `${field} 不能超过 ${params} 个字符`,
  },
  min_value: {
    name: 'min_value',
    validate: (value: number, min: number) => {
      if (value === undefined || value === null) {
        return true;
      }
      return value >= min;
    },
    message: (field: string, params: any) => `${field} 不能小于 ${params}`,
  },
  max_value: {
    name: 'max_value',
    validate: (value: number, max: number) => {
      if (value === undefined || value === null) {
        return true;
      }
      return value <= max;
    },
    message: (field: string, params: any) => `${field} 不能大于 ${params}`,
  },
  confirmed: {
    name: 'confirmed',
    validate: (value: any, target: string, formData: any) => {
      if (!value) {
        return true;
      }
      return value === formData[target];
    },
    message: (field: string) => `${field} 不匹配`,
  },
};

// 解析验证规则字符串
function parseRule(ruleStr: string) {
  const [name, ...params] = ruleStr.split(':');
  return { name, params };
}

export function useFormValidation(props: FormProps, formData: Recordable) {
  const errors = reactive<Record<string, string>>({});
  const customRules: Record<string, ValidationRule> = {};

  // 获取所有规则（内置 + 自定义）
  function getRules() {
    return { ...builtInRules, ...customRules };
  }

  // 验证单个字段
  function validateField(
    fieldName: string,
    value: any,
    rules: string | Record<string, any> | ValidationRuleFunction | undefined,
  ): string | null {
    if (!rules) {
      return null;
    }

    const rulesMap = getRules();
    const fieldConfig = props.fields.find(f => f.name === fieldName);
    const fieldLabel = fieldConfig?.label || fieldName;

    // 处理字符串格式的规则
    if (typeof rules === 'string') {
      const ruleList = rules.split('|');

      for (const ruleStr of ruleList) {
        const { name, params } = parseRule(ruleStr);

        if (!name) {
          continue;
        }

        const rule = rulesMap[name];

        if (!rule) {
          continue;
        }

        const isValid = rule.validate(value, ...(params ? [params] : []), formData);
        if (isValid !== true) {
          return typeof rule.message === 'function'
            ? rule.message(fieldLabel, params)
            : rule.message;
        }
      }
    } else if (typeof rules === 'object' && rules !== null) {
      // 处理对象格式的规则
      for (const [ruleName, ruleParams] of Object.entries(rules)) {
        const rule = rulesMap[ruleName];
        if (!rule) {
          continue;
        }

        const isValid = rule.validate(value, ruleParams, formData);
        if (isValid !== true) {
          return typeof rule.message === 'function'
            ? rule.message(fieldLabel, ruleParams)
            : rule.message;
        }
      }
    } else if (typeof rules === 'function') {
      // 处理函数格式的规则
      const result = rules(value, formData);
      if (result !== true) {
        return result || `${fieldLabel} 验证失败`;
      }
    }

    return null;
  }

  // 验证整个表单
  async function validate(): Promise<boolean> {
    // 清空旧错误
    Object.keys(errors).forEach(key => delete errors[key]);
    let isValid = true;

    for (const field of props.fields) {
      if (!field.name || !field.validation) {
        continue;
      }

      const error = validateField(field.name, formData[field.name], field.validation);
      if (error) {
        errors[field.name] = error;
        isValid = false;
      }
    }

    return isValid;
  }

  // 判断字段是否必填
  function isFieldRequired(field: FormField): boolean {
    if (!field.validation) {
      return false;
    }

    if (typeof field.validation === 'string') {
      return field.validation.includes('required');
    }

    if (typeof field.validation === 'object' && field.validation !== null) {
      return 'required' in field.validation;
    }

    return false;
  }

  return {
    errors,
    validate,
    isFieldRequired,
  };
}
