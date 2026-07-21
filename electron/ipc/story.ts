// 故事 IPC 通道注册
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

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerStoryIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 创建故事
  ipcMain.handle('story:create', async (event, request: CreateStoryRequest) => {
    assertTrustedSender(event);
    return createStory(request);
  });
  // 删除故事
  ipcMain.handle('story:delete', async (event, request: DeleteStoryRequest) => {
    assertTrustedSender(event);
    return deleteStory(request);
  });
  // 查询故事工作区
  ipcMain.handle('story:get-workspace', async event => {
    assertTrustedSender(event);
    return getStoryWorkspace();
  });
  // 更新故事
  ipcMain.handle('story:update', async (event, request: UpdateStoryRequest) => {
    assertTrustedSender(event);
    return updateStory(request);
  });
  // 保存故事会话
  ipcMain.handle(
    'story:save-conversation',
    async (event, request: SaveStoryConversationRequest) => {
      assertTrustedSender(event);
      return saveStoryConversation(request);
    },
  );
  // 创建故事分镜
  ipcMain.handle('story:create-shot', async (event, request: CreateStoryShotRequest) => {
    assertTrustedSender(event);
    return createStoryShot(request);
  });
  // 更新故事分镜
  ipcMain.handle('story:update-shot', async (event, request: UpdateStoryShotRequest) => {
    assertTrustedSender(event);
    return updateStoryShot(request);
  });
  // 移动故事分镜
  ipcMain.handle('story:move-shot', async (event, request: MoveStoryShotRequest) => {
    assertTrustedSender(event);
    return moveStoryShot(request);
  });
  // 删除故事分镜
  ipcMain.handle('story:delete-shot', async (event, request: DeleteStoryShotRequest) => {
    assertTrustedSender(event);
    return deleteStoryShot(request);
  });
  // 生成故事分镜
  ipcMain.handle('story:generate-shot', async (event, request: GenerateStoryShotRequest) => {
    assertTrustedSender(event);
    return generateStoryShot(request);
  });
  // 查询故事分镜任务
  ipcMain.handle('story:get-shot-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getStoryShotTask(taskId);
  });
  // 选中故事分镜版本
  ipcMain.handle(
    'story:select-shot-version',
    async (event, request: SelectStoryShotVersionRequest) => {
      assertTrustedSender(event);
      return selectStoryShotVersion(request);
    },
  );
  // 删除故事分镜版本
  ipcMain.handle(
    'story:delete-shot-version',
    async (event, request: DeleteStoryShotVersionRequest) => {
      assertTrustedSender(event);
      return deleteStoryShotVersion(request);
    },
  );
}