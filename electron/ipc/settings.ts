// 桌面设置、主题、目录选择、工作区 IPC 通道注册
import { BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron';
import type { OpenDialogOptions } from 'electron';
import type { DesktopTheme } from '../../shared/desktop';
import {
  getDesktopSettings,
  getSuggestedWorkspacePath,
  openWorkspaceDirectory,
  setWorkspaceDirectory,
} from '../services/workspace';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerSettingsIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 查询桌面设置
  ipcMain.handle('settings:get', async event => {
    assertTrustedSender(event);
    return getDesktopSettings();
  });

  // 设置主题（含类型校验，避免渲染端传脏值）
  ipcMain.handle('settings:set-theme', async (event, theme: unknown) => {
    assertTrustedSender(event);
    if (!isDesktopTheme(theme)) {
      throw new TypeError('界面主题无效');
    }
    nativeTheme.themeSource = theme;
  });

  // 弹出系统目录选择对话框，返回所选路径
  ipcMain.handle('dialog:select-directory', async event => {
    assertTrustedSender(event);
    const settings = await getDesktopSettings();
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      defaultPath: settings.workspacePath ?? settings.suggestedWorkspacePath,
      properties: ['openDirectory', 'createDirectory'],
    };
    // 绑到当前 webContents 所属窗口，使对话框模态
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  // 设置工作区目录（含类型校验）
  ipcMain.handle('workspace:set-directory', async (event, workspacePath: unknown) => {
    assertTrustedSender(event);
    if (typeof workspacePath !== 'string') {
      throw new TypeError('工作区目录无效');
    }
    return setWorkspaceDirectory(workspacePath);
  });

  // 使用推荐工作区目录
  ipcMain.handle('workspace:use-suggested', async event => {
    assertTrustedSender(event);
    return setWorkspaceDirectory(getSuggestedWorkspacePath());
  });

  // 在系统文件管理器中打开工作区目录
  ipcMain.handle('workspace:open', async event => {
    assertTrustedSender(event);
    await openWorkspaceDirectory();
  });
}

// 主题值白名单校验
function isDesktopTheme(theme: unknown): theme is DesktopTheme {
  return theme === 'dark' || theme === 'light' || theme === 'system';
}