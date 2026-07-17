import { ipcMain } from 'electron';
import type {
  DeleteCharacterPortraitRequest,
  GenerateCharacterPortraitRequest,
  SelectCharacterPortraitRequest,
} from '../../shared/character-portrait';
import {
  deleteCharacterPortrait,
  generateCharacterPortrait,
  getCharacterPortraitTask,
  getCharacterPortraitWorkspace,
  selectCharacterPortrait,
} from '../services/character-portrait';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCharacterPortraitIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle(
    'character-portrait:delete',
    async (event, request: DeleteCharacterPortraitRequest) => {
      assertTrustedSender(event);
      return deleteCharacterPortrait(request);
    },
  );

  ipcMain.handle(
    'character-portrait:generate',
    async (event, request: GenerateCharacterPortraitRequest) => {
      assertTrustedSender(event);
      return generateCharacterPortrait(request);
    },
  );

  ipcMain.handle('character-portrait:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getCharacterPortraitTask(taskId);
  });

  ipcMain.handle('character-portrait:get-workspace', async event => {
    assertTrustedSender(event);
    return getCharacterPortraitWorkspace();
  });

  ipcMain.handle(
    'character-portrait:select',
    async (event, request: SelectCharacterPortraitRequest) => {
      assertTrustedSender(event);
      return selectCharacterPortrait(request);
    },
  );
}
