// 凭据 IPC 通道注册
import { ipcMain } from 'electron';
import type { SetCredentialRequest } from '../../shared/desktop';
import {
  deleteCredential,
  getCredentialStatus,
  isCredentialService,
  setCredential,
} from '../services/credentials';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerCredentialsIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 查询凭据状态（含类型校验）
  ipcMain.handle('credential:get-status', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return getCredentialStatus(service);
  });

  // 设置凭据
  ipcMain.handle('credential:set', async (event, request: SetCredentialRequest) => {
    assertTrustedSender(event);
    return setCredential(request);
  });

  // 删除凭据（含类型校验）
  ipcMain.handle('credential:delete', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return deleteCredential(service);
  });
}