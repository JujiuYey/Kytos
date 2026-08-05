// 角色视觉资产 IPC 通道注册
import { ipcMain } from 'electron';
import type { CharacterScopeRequest } from '../../shared/character-library';
import type {
  CharacterVisualAssetSelection,
  GenerateCharacterActionPromptRequest,
  GenerateCharacterActionRequest,
  GenerateCharacterReferenceBoardRequest,
  RenameCharacterVisualAssetRequest,
  SetCharacterVisualAssetOfficialRequest,
  UploadCharacterVisualAssetRequest,
} from '../../shared/character-visual';
import {
  deleteCharacterVisualAsset,
  generateCharacterAction,
  generateCharacterActionPrompt,
  generateCharacterReferenceBoard,
  getCharacterVisualAssetTask,
  getCharacterVisualWorkspace,
  renameCharacterVisualAsset,
  setCharacterVisualAssetOfficial,
  uploadCharacterVisualAsset,
} from '../services/character-visual';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCharacterVisualIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle(
    'character-visual:delete',
    async (event, request: CharacterVisualAssetSelection) => {
      assertTrustedSender(event);
      return deleteCharacterVisualAsset(request);
    },
  );

  ipcMain.handle(
    'character-visual:generate-action',
    async (event, request: GenerateCharacterActionRequest) => {
      assertTrustedSender(event);
      return generateCharacterAction(request);
    },
  );

  ipcMain.handle(
    'character-visual:generate-action-prompt',
    async (event, request: GenerateCharacterActionPromptRequest) => {
      assertTrustedSender(event);
      return generateCharacterActionPrompt(request);
    },
  );

  ipcMain.handle(
    'character-visual:generate-reference-board',
    async (event, request: GenerateCharacterReferenceBoardRequest) => {
      assertTrustedSender(event);
      return generateCharacterReferenceBoard(request);
    },
  );

  ipcMain.handle('character-visual:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getCharacterVisualAssetTask(taskId);
  });

  ipcMain.handle(
    'character-visual:get-workspace',
    async (event, request?: CharacterScopeRequest) => {
      assertTrustedSender(event);
      return getCharacterVisualWorkspace(request?.characterId);
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
}
