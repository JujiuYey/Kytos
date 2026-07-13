// Type definitions for the gacha feature. Mirrors the Rust structs in
// `src-tauri/src/gacha/` — keep these in sync when the API changes.

export interface ImageRef {
  path: string;
  index: number;
  mtime: number;
}

export interface PromptSummary {
  name: string;
  md_path: string;
  size: string;
  resolution: string;
  images: ImageRef[];
}

export interface Category {
  name: string;
  prompts: PromptSummary[];
}

export interface BaselineFile {
  path: string;
  mtime: number;
}

export interface Baselines {
  dingzhuangzhao: BaselineFile | null;
  jiaosebiao: BaselineFile | null;
}

export interface Project {
  root: string;
  categories: Category[];
  baselines: Baselines;
  has_api_key: boolean;
  has_deepseek_key: boolean;
}

export interface PromptDetail {
  raw: string;
  prompt: string;
  size: string;
  resolution: string;
}

export interface FailedDownload {
  path: string;
  url: string;
}

export interface DrawResult {
  task_id: string;
  urls: string[];
  saved: string[];
  failed: FailedDownload[];
  payload_preview?: unknown;
}

export interface DrawRequest {
  root: string;
  md_path: string;
  no_ref?: boolean;
  extra_refs?: string[];
  size?: string | null;
  resolution?: string | null;
  dry_run?: boolean;
}

export interface DrawProgress {
  stage: 'building' | 'submitted' | 'polling' | 'downloading' | 'done' | 'failed';
  message: string;
  task_id?: string;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
}
