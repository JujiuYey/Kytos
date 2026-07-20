import type { BrowserWindow } from 'electron';
import { registerArtStyleIpc } from './art-style';
import { registerCharacterExpressionIpc } from './character-expression';
import { registerCharacterIpc } from './character';
import { registerCharacterLibraryIpc } from './character-library';
import { registerCharacterPortraitIpc } from './character-portrait';
import { registerCharacterVisualCardIpc } from './character-visual-card';
import { registerCredentialsIpc } from './credentials';
import { registerFilesIpc } from './files';
import { registerIllustrationIpc } from './illustration';
import { registerSettingsIpc } from './settings';
import { registerStoryIpc } from './story';
import { createTrustedSenderGuard } from './trusted-sender';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  const assertTrustedSender = createTrustedSenderGuard(getMainWindow);
  registerArtStyleIpc(assertTrustedSender);
  registerCharacterIpc(assertTrustedSender);
  registerCharacterLibraryIpc(assertTrustedSender);
  registerCharacterExpressionIpc(assertTrustedSender);
  registerCharacterPortraitIpc(assertTrustedSender);
  registerCharacterVisualCardIpc(assertTrustedSender);
  registerSettingsIpc(assertTrustedSender);
  registerCredentialsIpc(assertTrustedSender);
  registerFilesIpc(assertTrustedSender);
  registerIllustrationIpc(assertTrustedSender);
  registerStoryIpc(assertTrustedSender);
}
