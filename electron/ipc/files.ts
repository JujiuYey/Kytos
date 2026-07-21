// 文件保存 IPC 通道注册
import { ipcMain } from 'electron';
import type { SaveFileRequest, SavedFileResult } from '../../shared/desktop';
import { saveWorkspaceFile } from '../services/workspace';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerFilesIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 保存文件到工作区
  ipcMain.handle('file:save', async (event, request: SaveFileRequest): Promise<SavedFileResult> => {
    assertTrustedSender(event);
    return saveWorkspaceFile(request);
  });
}