// Ollama API 相关类型定义

// API响应接口
export interface OllamaResponse {
  response: string;
  done: boolean;
  context?: number[];
}

// 模型信息接口
export interface ModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

// API请求接口
export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  system?: string;
  temperature?: number;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

// 模型列表响应接口
export interface ModelsResponse {
  models: ModelInfo[];
}
