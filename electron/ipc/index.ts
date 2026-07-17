import type { BrowserWindow } from 'electron';
import { registerCharacterIpc } from './character';
import { registerCredentialsIpc } from './credentials';
import { registerFilesIpc } from './files';
import { registerSettingsIpc } from './settings';
import { createTrustedSenderGuard } from './trusted-sender';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  const assertTrustedSender = createTrustedSenderGuard(getMainWindow);
  registerCharacterIpc(assertTrustedSender);
  registerSettingsIpc(assertTrustedSender);
  registerCredentialsIpc(assertTrustedSender);
  registerFilesIpc(assertTrustedSender);
}
