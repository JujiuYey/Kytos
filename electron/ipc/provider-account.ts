// 厂商账户信息 IPC 通道注册
import { ipcMain } from 'electron';
import { isCredentialService } from '../services/credentials';
import {
  getBalanceResult,
  getModelsResult,
  getUsageResult,
  refreshBalanceResult,
  refreshModelsResult,
  refreshUsageResult,
} from '../services/provider-account';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerProviderAccountIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 查询余额快照（读缓存，不发起网络请求）
  ipcMain.handle('provider-account:get-balance', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return getBalanceResult(service);
  });

  // 查询可用模型快照（读缓存，不发起网络请求）
  ipcMain.handle('provider-account:get-models', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return getModelsResult(service);
  });

  // 重新拉取余额
  ipcMain.handle('provider-account:refresh-balance', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return refreshBalanceResult(service);
  });

  // 重新拉取可用模型
  ipcMain.handle('provider-account:refresh-models', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return refreshModelsResult(service);
  });

  // 查询消费用量快照（读缓存，不发起网络请求）
  ipcMain.handle('provider-account:get-usage', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return getUsageResult(service);
  });

  // 重新拉取消费用量
  ipcMain.handle('provider-account:refresh-usage', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return refreshUsageResult(service);
  });
}
