import type { BrowserWindow } from 'electron';
import { registerCharacterExpressionIpc } from './character-expression';
import { registerCharacterIpc } from './character';
import { registerCharacterPortraitIpc } from './character-portrait';
import { registerCredentialsIpc } from './credentials';
import { registerFilesIpc } from './files';
import { registerIllustrationIpc } from './illustration';
import { registerSettingsIpc } from './settings';
import { createTrustedSenderGuard } from './trusted-sender';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  const assertTrustedSender = createTrustedSenderGuard(getMainWindow);
  registerCharacterIpc(assertTrustedSender);
  registerCharacterExpressionIpc(assertTrustedSender);
  registerCharacterPortraitIpc(assertTrustedSender);
  registerSettingsIpc(assertTrustedSender);
  registerCredentialsIpc(assertTrustedSender);
  registerFilesIpc(assertTrustedSender);
  registerIllustrationIpc(assertTrustedSender);
}
