// 角色表情 IPC 通道注册
import { ipcMain } from 'electron';
import type {
  DeleteCharacterExpressionRequest,
  GenerateCharacterExpressionRequest,
  GenerateCharacterExpressionPromptRequest,
  GetCharacterExpressionTaskRequest,
  GetCharacterExpressionWorkspaceRequest,
  RenameCharacterExpressionRequest,
  UploadCharacterExpressionRequest,
} from '../../shared/character-expression';
import {
  deleteCharacterExpression,
  generateCharacterExpression,
  generateCharacterExpressionPrompt,
  getCharacterExpressionTask,
  getCharacterExpressionWorkspace,
  renameCharacterExpression,
  uploadCharacterExpression,
} from '../services/character-expression';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerCharacterExpressionIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 删除角色表情
  ipcMain.handle(
    'character-expression:delete',
    async (event, request: DeleteCharacterExpressionRequest) => {
      assertTrustedSender(event);
      return deleteCharacterExpression(request);
    },
  );

  // 生成角色表情
  ipcMain.handle(
    'character-expression:generate',
    async (event, request: GenerateCharacterExpressionRequest) => {
      assertTrustedSender(event);
      return generateCharacterExpression(request);
    },
  );

  // 生成角色表情提示词
  ipcMain.handle(
    'character-expression:generate-prompt',
    async (event, request: GenerateCharacterExpressionPromptRequest) => {
      assertTrustedSender(event);
      return generateCharacterExpressionPrompt(request);
    },
  );

  // 查询角色表情任务
  ipcMain.handle(
    'character-expression:get-task',
    async (event, request: GetCharacterExpressionTaskRequest) => {
      assertTrustedSender(event);
      return getCharacterExpressionTask(request);
    },
  );

  // 查询角色表情工作区
  ipcMain.handle(
    'character-expression:get-workspace',
    async (event, request: GetCharacterExpressionWorkspaceRequest) => {
      assertTrustedSender(event);
      return getCharacterExpressionWorkspace(request);
    },
  );

  // 重命名角色表情
  ipcMain.handle(
    'character-expression:rename',
    async (event, request: RenameCharacterExpressionRequest) => {
      assertTrustedSender(event);
      return renameCharacterExpression(request);
    },
  );

  // 上传角色表情
  ipcMain.handle(
    'character-expression:upload',
    async (event, request: UploadCharacterExpressionRequest) => {
      assertTrustedSender(event);
      return uploadCharacterExpression(request);
    },
  );
}