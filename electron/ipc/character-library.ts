// 角色库 + 角色视觉素材生成 IPC 通道注册
import { ipcMain } from 'electron';
import type {
  CreateCharacterRequest,
  DeleteCharacterRequest,
  SelectCharacterRequest,
  UpdateCharacterRequest,
} from '../../shared/character-library';
import type {
  GenerateCharacterVisualRequest,
  GetCharacterVisualGenerationRequest,
  SaveCharacterVisualAssetRequest,
  SaveCharacterVisualRequest,
} from '../../shared/character-create';
import {
  createCharacter,
  deleteCharacter,
  getCharacterLibrary,
  selectCharacter,
  updateCharacter,
} from '../services/character-library';
import {
  generateCharacterVisual,
  getCharacterVisualGeneration,
  saveCharacterVisual,
  saveCharacterVisualAsset,
} from '../services/character-create';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerCharacterLibraryIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 创建角色概要
  ipcMain.handle(
    'character-library:create-character',
    async (event, request: CreateCharacterRequest) => {
      assertTrustedSender(event);
      return createCharacter(request);
    },
  );
  // 查询角色库
  ipcMain.handle('character-library:get', async event => {
    assertTrustedSender(event);
    return getCharacterLibrary();
  });
  // 保存角色视觉素材资源
  ipcMain.handle(
    'character-library:save-visual-asset',
    async (event, request: SaveCharacterVisualAssetRequest) => {
      assertTrustedSender(event);
      return saveCharacterVisualAsset(request);
    },
  );
  // 生成角色视觉素材
  ipcMain.handle(
    'character-library:generate-visual',
    async (event, request: GenerateCharacterVisualRequest) => {
      assertTrustedSender(event);
      return generateCharacterVisual(request);
    },
  );
  // 查询角色视觉素材生成结果
  ipcMain.handle(
    'character-library:get-visual-generation',
    async (event, request: GetCharacterVisualGenerationRequest) => {
      assertTrustedSender(event);
      return getCharacterVisualGeneration(request);
    },
  );
  // 保存角色视觉素材
  ipcMain.handle(
    'character-library:save-visual',
    async (event, request: SaveCharacterVisualRequest) => {
      assertTrustedSender(event);
      return saveCharacterVisual(request);
    },
  );
  // 删除角色
  ipcMain.handle(
    'character-library:delete-character',
    async (event, request: DeleteCharacterRequest) => {
      assertTrustedSender(event);
      return deleteCharacter(request);
    },
  );
  // 选中角色
  ipcMain.handle(
    'character-library:select-character',
    async (event, request: SelectCharacterRequest) => {
      assertTrustedSender(event);
      return selectCharacter(request);
    },
  );
  // 更新角色概要
  ipcMain.handle(
    'character-library:update-character',
    async (event, request: UpdateCharacterRequest) => {
      assertTrustedSender(event);
      return updateCharacter(request);
    },
  );
}
