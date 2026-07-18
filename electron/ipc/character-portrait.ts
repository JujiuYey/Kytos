import { ipcMain } from 'electron';
import type {
  DeleteCharacterPortraitRequest,
  DeleteCharacterSheetRequest,
  GenerateCharacterPortraitRequest,
  GenerateCharacterSheetRequest,
  SelectCharacterPortraitRequest,
  SelectCharacterSheetRequest,
} from '../../shared/character-portrait';
import type { SaveFileRequest } from '../../shared/desktop';
import {
  deleteCharacterPortrait,
  deleteCharacterSheet,
  generateCharacterPortrait,
  generateCharacterSheet,
  getCharacterPortraitTask,
  getCharacterPortraitWorkspace,
  getCharacterSheetTask,
  selectCharacterPortrait,
  selectCharacterSheet,
  uploadCharacterPortrait,
  uploadCharacterSheet,
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

  ipcMain.handle('character-sheet:delete', async (event, request: DeleteCharacterSheetRequest) => {
    assertTrustedSender(event);
    return deleteCharacterSheet(request);
  });

  ipcMain.handle(
    'character-portrait:generate',
    async (event, request: GenerateCharacterPortraitRequest) => {
      assertTrustedSender(event);
      return generateCharacterPortrait(request);
    },
  );

  ipcMain.handle(
    'character-sheet:generate',
    async (event, request: GenerateCharacterSheetRequest) => {
      assertTrustedSender(event);
      return generateCharacterSheet(request);
    },
  );

  ipcMain.handle('character-portrait:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getCharacterPortraitTask(taskId);
  });

  ipcMain.handle('character-sheet:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getCharacterSheetTask(taskId);
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

  ipcMain.handle('character-sheet:select', async (event, request: SelectCharacterSheetRequest) => {
    assertTrustedSender(event);
    return selectCharacterSheet(request);
  });

  ipcMain.handle('character-portrait:upload', async (event, request: SaveFileRequest) => {
    assertTrustedSender(event);
    return uploadCharacterPortrait(request);
  });

  ipcMain.handle('character-sheet:upload', async (event, request: SaveFileRequest) => {
    assertTrustedSender(event);
    return uploadCharacterSheet(request);
  });
}
