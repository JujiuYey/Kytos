import { ipcMain } from 'electron';
import type {
  DeleteCharacterExpressionRequest,
  GenerateCharacterExpressionRequest,
  GetCharacterExpressionTaskRequest,
  GetCharacterExpressionWorkspaceRequest,
  RenameCharacterExpressionRequest,
  UploadCharacterExpressionRequest,
} from '../../shared/character-expression';
import {
  deleteCharacterExpression,
  generateCharacterExpression,
  getCharacterExpressionTask,
  getCharacterExpressionWorkspace,
  renameCharacterExpression,
  uploadCharacterExpression,
} from '../services/character-expression';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCharacterExpressionIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle(
    'character-expression:delete',
    async (event, request: DeleteCharacterExpressionRequest) => {
      assertTrustedSender(event);
      return deleteCharacterExpression(request);
    },
  );

  ipcMain.handle(
    'character-expression:generate',
    async (event, request: GenerateCharacterExpressionRequest) => {
      assertTrustedSender(event);
      return generateCharacterExpression(request);
    },
  );

  ipcMain.handle(
    'character-expression:get-task',
    async (event, request: GetCharacterExpressionTaskRequest) => {
      assertTrustedSender(event);
      return getCharacterExpressionTask(request);
    },
  );

  ipcMain.handle(
    'character-expression:get-workspace',
    async (event, request: GetCharacterExpressionWorkspaceRequest) => {
      assertTrustedSender(event);
      return getCharacterExpressionWorkspace(request);
    },
  );

  ipcMain.handle(
    'character-expression:rename',
    async (event, request: RenameCharacterExpressionRequest) => {
      assertTrustedSender(event);
      return renameCharacterExpression(request);
    },
  );

  ipcMain.handle(
    'character-expression:upload',
    async (event, request: UploadCharacterExpressionRequest) => {
      assertTrustedSender(event);
      return uploadCharacterExpression(request);
    },
  );
}
