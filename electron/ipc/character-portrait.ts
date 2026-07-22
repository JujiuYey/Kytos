// 角色头像 / 设定图 / 视觉素材管理 IPC 通道注册
import { ipcMain } from 'electron';
import type { CharacterScopeRequest } from '../../shared/character-library';
import type {
  DeleteCharacterPortraitRequest,
  DeleteCharacterSheetRequest,
  GenerateCharacterActionPromptRequest,
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
  generateCharacterActionPrompt,
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

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerCharacterPortraitIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 删除角色头像
  ipcMain.handle(
    'character-portrait:delete',
    async (event, request: DeleteCharacterPortraitRequest) => {
      assertTrustedSender(event);
      return deleteCharacterPortrait(request);
    },
  );

  // 删除角色设定图
  ipcMain.handle('character-sheet:delete', async (event, request: DeleteCharacterSheetRequest) => {
    assertTrustedSender(event);
    return deleteCharacterSheet(request);
  });

  // 生成角色头像
  ipcMain.handle(
    'character-portrait:generate',
    async (event, request: GenerateCharacterPortraitRequest) => {
      assertTrustedSender(event);
      return generateCharacterPortrait(request);
    },
  );

  // 生成角色动作提示词
  ipcMain.handle(
    'character-portrait:generate-action-prompt',
    async (event, request: GenerateCharacterActionPromptRequest) => {
      assertTrustedSender(event);
      return generateCharacterActionPrompt(request);
    },
  );

  // 生成角色设定图
  ipcMain.handle(
    'character-sheet:generate',
    async (event, request: GenerateCharacterSheetRequest) => {
      assertTrustedSender(event);
      return generateCharacterSheet(request);
    },
  );

  // 查询角色头像任务
  ipcMain.handle('character-portrait:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getCharacterPortraitTask(taskId);
  });

  // 查询角色设定图任务
  ipcMain.handle('character-sheet:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getCharacterSheetTask(taskId);
  });

  // 查询角色头像工作区（可选的角色 ID 用于过滤）
  ipcMain.handle(
    'character-portrait:get-workspace',
    async (event, request?: CharacterScopeRequest) => {
      assertTrustedSender(event);
      return getCharacterPortraitWorkspace(request?.characterId);
    },
  );

  // 重命名角色视觉素材
  ipcMain.handle(
    'character-visual:rename',
    async (event, request: RenameCharacterVisualAssetRequest) => {
      assertTrustedSender(event);
      return renameCharacterVisualAsset(request);
    },
  );

  // 设为官方角色视觉素材
  ipcMain.handle(
    'character-visual:set-official',
    async (event, request: SetCharacterVisualAssetOfficialRequest) => {
      assertTrustedSender(event);
      return setCharacterVisualAssetOfficial(request);
    },
  );

  // 上传角色视觉素材
  ipcMain.handle(
    'character-visual:upload',
    async (event, request: UploadCharacterVisualAssetRequest) => {
      assertTrustedSender(event);
      return uploadCharacterVisualAsset(request);
    },
  );

  // 选中角色头像
  ipcMain.handle(
    'character-portrait:select',
    async (event, request: SelectCharacterPortraitRequest) => {
      assertTrustedSender(event);
      return selectCharacterPortrait(request);
    },
  );

  // 选中角色设定图
  ipcMain.handle('character-sheet:select', async (event, request: SelectCharacterSheetRequest) => {
    assertTrustedSender(event);
    return selectCharacterSheet(request);
  });

  // 上传角色头像
  ipcMain.handle('character-portrait:upload', async (event, request: SaveFileRequest) => {
    assertTrustedSender(event);
    return uploadCharacterPortrait(request);
  });

  // 上传角色设定图
  ipcMain.handle('character-sheet:upload', async (event, request: SaveFileRequest) => {
    assertTrustedSender(event);
    return uploadCharacterSheet(request);
  });
}
