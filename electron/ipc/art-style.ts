import { ipcMain } from 'electron';
import type {
  DeleteArtStyleRequest,
  SaveArtStyleRequest,
  SelectArtStyleRequest,
} from '../../shared/art-style';
import {
  deleteArtStyle,
  getArtStyleWorkspace,
  saveArtStyle,
  selectArtStyle,
} from '../services/art-style';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerArtStyleIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('art-style:get-workspace', async event => {
    assertTrustedSender(event);
    return getArtStyleWorkspace();
  });
  ipcMain.handle('art-style:save', async (event, request: SaveArtStyleRequest) => {
    assertTrustedSender(event);
    return saveArtStyle(request);
  });
  ipcMain.handle('art-style:select', async (event, request: SelectArtStyleRequest) => {
    assertTrustedSender(event);
    return selectArtStyle(request);
  });
  ipcMain.handle('art-style:delete', async (event, request: DeleteArtStyleRequest) => {
    assertTrustedSender(event);
    return deleteArtStyle(request);
  });
}
