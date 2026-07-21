// 插画 IPC 通道注册
import { ipcMain } from 'electron';
import type {
  CreateIllustrationTopicRequest,
  DeleteIllustrationUploadRequest,
  DeleteIllustrationTopicRequest,
  DeleteIllustrationVersionRequest,
  GenerateIllustrationRequest,
  SaveIllustrationConversationRequest,
  UpdateIllustrationTopicRequest,
  UploadIllustrationRequest,
} from '../../shared/illustration';
import {
  createIllustrationTopic,
  deleteIllustrationUpload,
  deleteIllustrationTopic,
  deleteIllustrationVersion,
  generateIllustration,
  getIllustrationTask,
  getIllustrationWorkspace,
  saveIllustrationConversation,
  updateIllustrationTopic,
  uploadIllustration,
} from '../services/illustration';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerIllustrationIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 创建插画主题
  ipcMain.handle(
    'illustration:create-topic',
    async (event, request: CreateIllustrationTopicRequest) => {
      assertTrustedSender(event);
      return createIllustrationTopic(request);
    },
  );
  // 删除插画主题
  ipcMain.handle(
    'illustration:delete-topic',
    async (event, request: DeleteIllustrationTopicRequest) => {
      assertTrustedSender(event);
      return deleteIllustrationTopic(request);
    },
  );
  // 删除插画版本
  ipcMain.handle(
    'illustration:delete-version',
    async (event, request: DeleteIllustrationVersionRequest) => {
      assertTrustedSender(event);
      return deleteIllustrationVersion(request);
    },
  );
  // 删除已上传插画
  ipcMain.handle(
    'illustration:delete-upload',
    async (event, request: DeleteIllustrationUploadRequest) => {
      assertTrustedSender(event);
      return deleteIllustrationUpload(request);
    },
  );
  // 生成插画
  ipcMain.handle('illustration:generate', async (event, request: GenerateIllustrationRequest) => {
    assertTrustedSender(event);
    return generateIllustration(request);
  });
  // 查询插画任务
  ipcMain.handle('illustration:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getIllustrationTask(taskId);
  });
  // 查询插画工作区
  ipcMain.handle('illustration:get-workspace', async event => {
    assertTrustedSender(event);
    return getIllustrationWorkspace();
  });
  // 保存插画会话
  ipcMain.handle(
    'illustration:save-conversation',
    async (event, request: SaveIllustrationConversationRequest) => {
      assertTrustedSender(event);
      return saveIllustrationConversation(request);
    },
  );
  // 更新插画主题
  ipcMain.handle(
    'illustration:update-topic',
    async (event, request: UpdateIllustrationTopicRequest) => {
      assertTrustedSender(event);
      return updateIllustrationTopic(request);
    },
  );
  // 上传插画
  ipcMain.handle('illustration:upload', async (event, request: UploadIllustrationRequest) => {
    assertTrustedSender(event);
    return uploadIllustration(request);
  });
}