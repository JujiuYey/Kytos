import { ipcMain } from 'electron';
import type { SaveCharacterProfileRequest } from '../../shared/character';
import { getCharacterWorkspace, saveCharacterProfile } from '../services/character-workspace';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCharacterIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('character:get-workspace', async event => {
    assertTrustedSender(event);
    return getCharacterWorkspace();
  });

  ipcMain.handle('character:save-profile', async (event, request: SaveCharacterProfileRequest) => {
    assertTrustedSender(event);
    await saveCharacterProfile(request);
  });
}
