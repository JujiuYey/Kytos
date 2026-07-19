import { ipcMain } from 'electron';
import type { CharacterScopeRequest } from '../../shared/character-library';
import type {
  DeleteCharacterPortraitRequest,
  DeleteCharacterSheetRequest,
  GenerateCharacterPortraitRequest,
  GenerateCharacterSheetRequest,
  RenameCharacterVisualAssetRequest,
  SelectCharacterPortraitRequest,
  SelectCharacterSheetRequest,
  SetCharacterVisualAssetOfficialRequest,
  UploadCharacterVisualAssetRequest,
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
  renameCharacterVisualAsset,
  selectCharacterPortrait,
  selectCharacterSheet,
  setCharacterVisualAssetOfficial,
  uploadCharacterPortrait,
  uploadCharacterSheet,
  uploadCharacterVisualAsset,
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

  ipcMain.handle(
    'character-portrait:get-workspace',
    async (event, request?: CharacterScopeRequest) => {
      assertTrustedSender(event);
      return getCharacterPortraitWorkspace(request?.characterId);
    },
  );

  ipcMain.handle(
    'character-visual:rename',
    async (event, request: RenameCharacterVisualAssetRequest) => {
      assertTrustedSender(event);
      return renameCharacterVisualAsset(request);
    },
  );

  ipcMain.handle(
    'character-visual:set-official',
    async (event, request: SetCharacterVisualAssetOfficialRequest) => {
      assertTrustedSender(event);
      return setCharacterVisualAssetOfficial(request);
    },
  );

  ipcMain.handle(
    'character-visual:upload',
    async (event, request: UploadCharacterVisualAssetRequest) => {
      assertTrustedSender(event);
      return uploadCharacterVisualAsset(request);
    },
  );

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
