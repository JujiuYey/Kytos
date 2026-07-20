import { ipcMain } from 'electron';
import type {
  GenerateCharacterVisualCardsRequest,
  GetCharacterVisualCardTaskRequest,
  SaveCharacterVisualCardRequest,
} from '../../shared/character-visual-card';
import {
  generateCharacterVisualCards,
  getCharacterVisualCardTask,
  getCharacterVisualCardWorkspace,
  saveCharacterVisualCard,
} from '../services/character-visual-card';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCharacterVisualCardIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('character-visual-card:get-workspace', async event => {
    assertTrustedSender(event);
    return getCharacterVisualCardWorkspace();
  });
  ipcMain.handle(
    'character-visual-card:generate',
    async (event, request: GenerateCharacterVisualCardsRequest) => {
      assertTrustedSender(event);
      return generateCharacterVisualCards(request);
    },
  );
  ipcMain.handle(
    'character-visual-card:save',
    async (event, request: SaveCharacterVisualCardRequest) => {
      assertTrustedSender(event);
      return saveCharacterVisualCard(request);
    },
  );
  ipcMain.handle(
    'character-visual-card:get-task',
    async (event, request: GetCharacterVisualCardTaskRequest) => {
      assertTrustedSender(event);
      return getCharacterVisualCardTask(request);
    },
  );
}
