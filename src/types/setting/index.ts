// 应用设置接口
export interface AppSettings {
  autoSave: boolean;
  theme: 'light' | 'dark' | 'system';
  storagePath: string;
  deepseekModel: string;
}
