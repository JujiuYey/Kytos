// 文件保存 IPC 通道注册
import { writeFile } from 'node:fs/promises';
import { dialog, ipcMain } from 'electron';
import type {
  ExportFileRequest,
  ExportFileResult,
  SaveFileRequest,
  SavedFileResult,
} from '../../shared/desktop';
import { saveWorkspaceFile } from '../services/workspace';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerFilesIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 导出文件到用户选择的位置
  ipcMain.handle(
    'file:export',
    async (event, request: ExportFileRequest): Promise<ExportFileResult> => {
      assertTrustedSender(event);
      const result = await dialog.showSaveDialog({
        defaultPath: request.fileName,
        filters: [{ extensions: getMimeTypeExtensions(request.mimeType), name: '图片' }],
      });
      if (result.canceled || !result.filePath) {
        return { canceled: true, filePath: null };
      }
      await writeFile(result.filePath, request.fileData);
      return { canceled: false, filePath: result.filePath };
    },
  );

  // 保存文件到工作区
  ipcMain.handle('file:save', async (event, request: SaveFileRequest): Promise<SavedFileResult> => {
    assertTrustedSender(event);
    return saveWorkspaceFile(request);
  });
}

function getMimeTypeExtensions(mimeType: string): string[] {
  const extensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
  };
  return extensions[mimeType] ?? ['png'];
}
