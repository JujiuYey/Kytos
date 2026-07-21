import type { DeepSeekModel } from '../../../shared/character';

// 应用设置接口
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  deepseekModel: DeepSeekModel;
}
