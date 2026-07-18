import { ipcMain } from 'electron';
import type {
  DeleteCharacterExpressionRequest,
  GenerateCharacterExpressionRequest,
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

  ipcMain.handle('character-expression:get-task', async (event, taskId: string) => {
    assertTrustedSender(event);
    return getCharacterExpressionTask(taskId);
  });

  ipcMain.handle('character-expression:get-workspace', async event => {
    assertTrustedSender(event);
    return getCharacterExpressionWorkspace();
  });

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
