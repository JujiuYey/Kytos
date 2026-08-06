// 桌面凭据、主题与工作区设置类型

// 凭据服务类型
export type CredentialService = 'apimart' | 'deepseek' | 'minimax';
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
