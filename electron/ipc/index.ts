import type { BrowserWindow } from 'electron';
import { registerCredentialsIpc } from './credentials';
import { registerFilesIpc } from './files';
import { registerSettingsIpc } from './settings';
import { createTrustedSenderGuard } from './trusted-sender';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  const assertTrustedSender = createTrustedSenderGuard(getMainWindow);
  registerSettingsIpc(assertTrustedSender);
  registerCredentialsIpc(assertTrustedSender);
  registerFilesIpc(assertTrustedSender);
}
