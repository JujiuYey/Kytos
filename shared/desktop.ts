// 桌面端 API 壳类型与暴露的命名空间结构
import type { StoryApi } from './story';
import type { IllustrationApi } from './illustration';
import type { CharacterLibraryApi } from './character-library';
import type { CharacterVisualAssetApi } from './character-visual';
import type { CharacterExpressionApi } from './character-expression';
import type { CharacterVisualApi } from './character-create';
import type {
  FileApi,
  SaveFileRequest,
  SavedFileResult,
  ExportFileRequest,
  ExportFileResult,
} from './file';
import type {
  CredentialService,
  CredentialStatus,
  SetCredentialRequest,
  DesktopSettings,
  DesktopTheme,
  SettingsApi,
} from './settings';

export type {
  StoryApi,
  IllustrationApi,
  CharacterLibraryApi,
  CharacterVisualAssetApi,
  CharacterExpressionApi,
  CharacterVisualApi,
  FileApi,
  SaveFileRequest,
  SavedFileResult,
  ExportFileRequest,
  ExportFileResult,
  CredentialService,
  CredentialStatus,
  SetCredentialRequest,
  DesktopSettings,
  DesktopTheme,
  SettingsApi,
};

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
    // 角色视觉资产
    assets: CharacterVisualAssetApi;
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
