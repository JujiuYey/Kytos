// 提示词模板接口
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'coding' | 'writing' | 'translation' | 'roleplay' | 'analysis' | 'other';
  prompt: string;
  isSystem?: boolean;
  icon?: string;
}

// 模板分类接口
export interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}
