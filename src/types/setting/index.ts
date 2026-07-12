// 应用设置接口
export interface AppSettings {
  autoSave: boolean;
  theme: 'light' | 'dark' | 'system';
  storagePath: string;
}

export interface OllamaServerConfig {
  ollamaUrl: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}
