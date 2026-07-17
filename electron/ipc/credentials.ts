import { ipcMain } from 'electron';
import type { SetCredentialRequest } from '../../shared/desktop';
import {
  deleteCredential,
  getCredentialStatus,
  isCredentialService,
  setCredential,
} from '../services/credentials';
import type { TrustedSenderGuard } from './trusted-sender';

export function registerCredentialsIpc(assertTrustedSender: TrustedSenderGuard): void {
  ipcMain.handle('credential:get-status', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return getCredentialStatus(service);
  });

  ipcMain.handle('credential:set', async (event, request: SetCredentialRequest) => {
    assertTrustedSender(event);
    return setCredential(request);
  });

  ipcMain.handle('credential:delete', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return deleteCredential(service);
  });
}
