import { ipcMain } from 'electron';
import type {
  CreateCharacterRequest,
  DeleteCharacterRequest,
  SelectCharacterRequest,
  UpdateCharacterRequest,
} from '../../shared/character-library';
import {
  createCharacter,
  deleteCharacter,
  getCharacterLibrary,
  selectCharacter,
  updateCharacter,
} from '../services/character-library';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCharacterLibraryIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('character-library:get', async event => {
    assertTrustedSender(event);
    return getCharacterLibrary();
  });
  ipcMain.handle(
    'character-library:create-character',
    async (event, request: CreateCharacterRequest) => {
      assertTrustedSender(event);
      return createCharacter(request);
    },
  );
  ipcMain.handle(
    'character-library:update-character',
    async (event, request: UpdateCharacterRequest) => {
      assertTrustedSender(event);
      return updateCharacter(request);
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
