import type { ChatModel, DeepSeekModel } from '../../../shared/chat-model';
import type { ImageModel } from '../../../shared/image-model';

// 应用设置接口
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  deepseekModel: DeepSeekModel;
  fastModel: ChatModel;
  generalModel: ChatModel;
  imageModel: ImageModel;
}
