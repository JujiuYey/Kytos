// 桌面端 API 壳类型与暴露的命名空间结构
import type { StoryApi } from './story';
import type { IllustrationApi } from './illustration';
import type { CharacterLibraryApi } from './character-library';
import type { CharacterPortraitApi } from './character-portrait';
import type { CharacterExpressionApi } from './character-expression';
import type { CharacterVisualApi } from './character-create';

export type { StoryApi, IllustrationApi, CharacterLibraryApi, CharacterPortraitApi, CharacterExpressionApi, CharacterVisualApi };

// 凭据服务类型
export type CredentialService = 'apimart' | 'deepseek';
// 桌面主题
export type DesktopTheme = 'dark' | 'light' | 'system';

// 桌面端设置
export interface DesktopSettings {
  // 建议工作区路径
  suggestedWorkspacePath: string;
  // 工作区路径
  workspacePath: string | null;
}

// 凭据状态
export interface CredentialStatus {
  // 是否已配置
  configured: boolean;
  // 安全存储是否可用
  secureStorageAvailable: boolean;
  // 服务标识
  service: CredentialService;
}

// 设置凭据请求
export interface SetCredentialRequest {
  // 服务标识
  service: CredentialService;
  // 凭据值
  value: string;
}

// 保存文件请求
export interface SaveFileRequest {
  // 文件名
  fileName: string;
  // 文件二进制内容
  fileData: Uint8Array;
  // MIME 类型
  mimeType: string;
}

// 已保存文件结果
export interface SavedFileResult {
  // 文件名
  fileName: string;
  // 原始文件名
  originalName: string;
  // 访问地址
  url: string;
  // 文件大小
  size: number;
  // MIME 类型
  mimeType: string;
}

// 设置与凭据 API
export interface SettingsApi {
  // 删除凭据
  deleteCredential: (service: CredentialService) => Promise<CredentialStatus>;
  // 查询凭据状态
  getCredentialStatus: (service: CredentialService) => Promise<CredentialStatus>;
  // 查询桌面设置
  getSettings: () => Promise<DesktopSettings>;
  // 打开工作区目录
  openWorkspaceDirectory: () => Promise<void>;
  // 选择目录
  selectDirectory: () => Promise<string | null>;
  // 设置凭据
  setCredential: (request: SetCredentialRequest) => Promise<CredentialStatus>;
  // 设置主题
  setTheme: (theme: DesktopTheme) => Promise<void>;
  // 设置工作区目录
  setWorkspaceDirectory: (workspacePath: string) => Promise<DesktopSettings>;
  // 使用推荐工作区
  useSuggestedWorkspace: () => Promise<DesktopSettings>;
}

// 文件 API
export interface FileApi {
  // 保存文件
  saveFile: (request: SaveFileRequest) => Promise<SavedFileResult>;
}

// 桌面端 API 命名空间
export interface DesktopApi {
  // 故事
  story: StoryApi;
  // 插画
  illustration: IllustrationApi;
  // 角色
  character: {
    // 角色库
    library: CharacterLibraryApi;
    // 角色头像与设定图
    portrait: CharacterPortraitApi;
    // 角色表情
    expression: CharacterExpressionApi;
    // 角色视觉素材生成
    visual: CharacterVisualApi;
  };
  // 设置与凭据
  settings: SettingsApi;
  // 文件
  file: FileApi;
}