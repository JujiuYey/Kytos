export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatRequest {
  root: string;
  history: ChatMessage[];
  model: string;
  request_id: string;
}

export interface ChatResult {
  md: string;
  model: string;
}

export interface ChatDelta {
  content: string;
  reasoning: string;
  mode: string;
  request_id: string;
}
