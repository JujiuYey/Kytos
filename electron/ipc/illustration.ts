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

export function registerIllustrationIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle(
    'illustration:create-topic',
    async (event, request: CreateIllustrationTopicRequest) => {
      assertTrustedSender(event);
      return createIllustrationTopic(request);
    },
  );
  ipcMain.handle(
    'illustration:delete-topic',
    async (event, request: DeleteIllustrationTopicRequest) => {
      assertTrustedSender(event);
      return deleteIllustrationTopic(request);
    },
  );
  ipcMain.handle(
    'illustration:delete-version',
    async (event, request: DeleteIllustrationVersionRequest) => {
      assertTrustedSender(event);
      return deleteIllustrationVersion(request);
    },
  );
  ipcMain.handle(
    'illustration:delete-upload',
    async (event, request: DeleteIllustrationUploadRequest) => {
      assertTrustedSender(event);
      return deleteIllustrationUpload(request);
    },
  );
  ipcMain.handle('illustration:generate', async (event, request: GenerateIllustrationRequest) => {
    assertTrustedSender(event);
    return generateIllustration(request);
  });
  ipcMain.handle('illustration:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getIllustrationTask(taskId);
  });
  ipcMain.handle('illustration:get-workspace', async event => {
    assertTrustedSender(event);
    return getIllustrationWorkspace();
  });
  ipcMain.handle(
    'illustration:save-conversation',
    async (event, request: SaveIllustrationConversationRequest) => {
      assertTrustedSender(event);
      return saveIllustrationConversation(request);
    },
  );
  ipcMain.handle(
    'illustration:update-topic',
    async (event, request: UpdateIllustrationTopicRequest) => {
      assertTrustedSender(event);
      return updateIllustrationTopic(request);
    },
  );
  ipcMain.handle('illustration:upload', async (event, request: UploadIllustrationRequest) => {
    assertTrustedSender(event);
    return uploadIllustration(request);
  });
}
