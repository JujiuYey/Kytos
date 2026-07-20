import { ipcMain } from 'electron';
import { getCharacterWorkspace } from '../services/character-workspace';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCharacterIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('character:get-workspace', async event => {
    assertTrustedSender(event);
    return getCharacterWorkspace();
  });
}
