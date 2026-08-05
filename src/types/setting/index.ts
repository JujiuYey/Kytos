import type { ChatModel, DeepSeekModel, ImageModel } from '../../../shared/character';

// 应用设置接口
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  deepseekModel: DeepSeekModel;
  fastModel: ChatModel;
  generalModel: ChatModel;
  imageModel: ImageModel;
}
