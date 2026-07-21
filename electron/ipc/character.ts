// 角色草稿工作区 IPC 通道注册
import { ipcMain } from 'electron';
import { getCharacterWorkspace } from '../services/character-workspace';
import type { TrustedSenderGuard } from './trusted-sender';

// 每个 handler 都先调 assertTrustedSender 验证发送方
export function registerCharacterIpc(assertTrustedSender: TrustedSenderGuard): void {
  // 查询角色草稿工作区
  ipcMain.handle('character:get-workspace', async event => {
    assertTrustedSender(event);
    return getCharacterWorkspace();
  });
}