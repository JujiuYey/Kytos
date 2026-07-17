import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { OpenDialogOptions } from 'electron';
import {
  getDesktopSettings,
  getSuggestedWorkspacePath,
  openWorkspaceDirectory,
  setWorkspaceDirectory,
} from '../services/workspace';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerSettingsIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('settings:get', async event => {
    assertTrustedSender(event);
    return getDesktopSettings();
  });

  ipcMain.handle('dialog:select-directory', async event => {
    assertTrustedSender(event);
    const settings = await getDesktopSettings();
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      defaultPath: settings.workspacePath ?? settings.suggestedWorkspacePath,
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('workspace:set-directory', async (event, workspacePath: unknown) => {
    assertTrustedSender(event);
    if (typeof workspacePath !== 'string') {
      throw new TypeError('工作区目录无效');
    }
    return setWorkspaceDirectory(workspacePath);
  });

  ipcMain.handle('workspace:use-suggested', async event => {
    assertTrustedSender(event);
    return setWorkspaceDirectory(getSuggestedWorkspacePath());
  });

  ipcMain.handle('workspace:open', async event => {
    assertTrustedSender(event);
    await openWorkspaceDirectory();
  });
}
