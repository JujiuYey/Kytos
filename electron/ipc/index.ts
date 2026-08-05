// 所有 IPC handler 的统一注册入口
import type { BrowserWindow } from 'electron';
import { registerCharacterExpressionIpc } from './character-expression';
import { registerCharacterIpc } from './character';
import { registerCharacterLibraryIpc } from './character-library';
import { registerCharacterVisualIpc } from './character-visual';
import { registerCredentialsIpc } from './credentials';
import { registerFilesIpc } from './files';
import { registerIllustrationIpc } from './illustration';
import { registerSettingsIpc } from './settings';
import { registerStoryIpc } from './story';
import { createTrustedSenderGuard } from './trusted-sender';

// 在主进程启动时一次性注册所有 IPC 通道
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // 守卫：只接受来自主窗口的请求，挡住 webview/iframe/外部页面
  const assertTrustedSender = createTrustedSenderGuard(getMainWindow);
  // 角色草稿工作区
  registerCharacterIpc(assertTrustedSender);
  // 角色库
  registerCharacterLibraryIpc(assertTrustedSender);
  // 角色表情
  registerCharacterExpressionIpc(assertTrustedSender);
  // 角色视觉资产
  registerCharacterVisualIpc(assertTrustedSender);
  // 桌面设置、主题、目录选择、工作区
  registerSettingsIpc(assertTrustedSender);
  // 凭据
  registerCredentialsIpc(assertTrustedSender);
  // 文件保存
  registerFilesIpc(assertTrustedSender);
  // 插画
  registerIllustrationIpc(assertTrustedSender);
  // 故事
  registerStoryIpc(assertTrustedSender);
}
