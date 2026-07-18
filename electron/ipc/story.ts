import { ipcMain } from 'electron';
import type {
  CreateStoryRequest,
  CreateStoryShotRequest,
  DeleteStoryRequest,
  DeleteStoryShotRequest,
  DeleteStoryShotVersionRequest,
  GenerateStoryShotRequest,
  MoveStoryShotRequest,
  SaveStoryConversationRequest,
  SelectStoryShotVersionRequest,
  UpdateStoryRequest,
  UpdateStoryShotRequest,
} from '../../shared/story';
import {
  createStory,
  createStoryShot,
  deleteStory,
  deleteStoryShot,
  deleteStoryShotVersion,
  generateStoryShot,
  getStoryShotTask,
  getStoryWorkspace,
  moveStoryShot,
  saveStoryConversation,
  selectStoryShotVersion,
  updateStory,
  updateStoryShot,
} from '../services/story';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerStoryIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('story:create', async (event, request: CreateStoryRequest) => {
    assertTrustedSender(event);
    return createStory(request);
  });
  ipcMain.handle('story:delete', async (event, request: DeleteStoryRequest) => {
    assertTrustedSender(event);
    return deleteStory(request);
  });
  ipcMain.handle('story:get-workspace', async event => {
    assertTrustedSender(event);
    return getStoryWorkspace();
  });
  ipcMain.handle('story:update', async (event, request: UpdateStoryRequest) => {
    assertTrustedSender(event);
    return updateStory(request);
  });
  ipcMain.handle(
    'story:save-conversation',
    async (event, request: SaveStoryConversationRequest) => {
      assertTrustedSender(event);
      return saveStoryConversation(request);
    },
  );
  ipcMain.handle('story:create-shot', async (event, request: CreateStoryShotRequest) => {
    assertTrustedSender(event);
    return createStoryShot(request);
  });
  ipcMain.handle('story:update-shot', async (event, request: UpdateStoryShotRequest) => {
    assertTrustedSender(event);
    return updateStoryShot(request);
  });
  ipcMain.handle('story:move-shot', async (event, request: MoveStoryShotRequest) => {
    assertTrustedSender(event);
    return moveStoryShot(request);
  });
  ipcMain.handle('story:delete-shot', async (event, request: DeleteStoryShotRequest) => {
    assertTrustedSender(event);
    return deleteStoryShot(request);
  });
  ipcMain.handle('story:generate-shot', async (event, request: GenerateStoryShotRequest) => {
    assertTrustedSender(event);
    return generateStoryShot(request);
  });
  ipcMain.handle('story:get-shot-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getStoryShotTask(taskId);
  });
  ipcMain.handle(
    'story:select-shot-version',
    async (event, request: SelectStoryShotVersionRequest) => {
      assertTrustedSender(event);
      return selectStoryShotVersion(request);
    },
  );
  ipcMain.handle(
    'story:delete-shot-version',
    async (event, request: DeleteStoryShotVersionRequest) => {
      assertTrustedSender(event);
      return deleteStoryShotVersion(request);
    },
  );
}
