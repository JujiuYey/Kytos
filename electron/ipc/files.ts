import { ipcMain } from 'electron';
import type { SaveFileRequest, SavedFileResult } from '../../shared/desktop';
import { saveWorkspaceFile } from '../services/workspace';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerFilesIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('file:save', async (event, request: SaveFileRequest): Promise<SavedFileResult> => {
    assertTrustedSender(event);
    return saveWorkspaceFile(request);
  });
}
