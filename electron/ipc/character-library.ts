import { ipcMain } from 'electron';
import type {
  DeleteCharacterRequest,
  SelectCharacterRequest,
} from '../../shared/character-library';
import type {
  GenerateCharacterVisualRequest,
  GetCharacterVisualGenerationRequest,
  SaveCharacterVisualRequest,
} from '../../shared/character-create';
import {
  deleteCharacter,
  getCharacterLibrary,
  selectCharacter,
} from '../services/character-library';
import {
  generateCharacterVisual,
  getCharacterVisualGeneration,
  saveCharacterVisual,
} from '../services/character-create';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCharacterLibraryIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('character-library:get', async event => {
    assertTrustedSender(event);
    return getCharacterLibrary();
  });
  ipcMain.handle(
    'character-library:generate-visual',
    async (event, request: GenerateCharacterVisualRequest) => {
      assertTrustedSender(event);
      return generateCharacterVisual(request);
    },
  );
  ipcMain.handle(
    'character-library:get-visual-generation',
    async (event, request: GetCharacterVisualGenerationRequest) => {
      assertTrustedSender(event);
      return getCharacterVisualGeneration(request);
    },
  );
  ipcMain.handle(
    'character-library:save-visual',
    async (event, request: SaveCharacterVisualRequest) => {
      assertTrustedSender(event);
      return saveCharacterVisual(request);
    },
  );
  ipcMain.handle(
    'character-library:delete-character',
    async (event, request: DeleteCharacterRequest) => {
      assertTrustedSender(event);
      return deleteCharacter(request);
    },
  );
  ipcMain.handle(
    'character-library:select-character',
    async (event, request: SelectCharacterRequest) => {
      assertTrustedSender(event);
      return selectCharacter(request);
    },
  );
}
