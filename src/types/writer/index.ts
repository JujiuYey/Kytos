// Type definitions for the writer feature (DeepSeek-backed prompt generation).
// Mirrors the Rust structs in `src-tauri/src/gacha/`.

export interface Context {
  ip: string;
  agents: string;
  ip_path: string;
  agents_path: string;
}

export type ContextKind = 'ip' | 'agents';

export interface DeepSeekDelta {
  content: string;
  reasoning: string;
}

export interface GenerateRequest {
  root: string;
  category: string;
  name: string;
  intent: string;
  model: string;
}

export interface GenerateResult {
  md: string;
  model: string;
}
