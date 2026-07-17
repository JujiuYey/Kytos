import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

type MainWindowProvider = () => BrowserWindow | null;

export type TrustedSenderGuard = (event: IpcMainInvokeEvent) => void;

export function createTrustedSenderGuard(getMainWindow: MainWindowProvider): TrustedSenderGuard {
  return event => {
    const mainWindow = getMainWindow();
    const isTrusted =
      mainWindow !== null &&
      event.sender === mainWindow.webContents &&
      event.senderFrame === mainWindow.webContents.mainFrame;

    if (!isTrusted) {
      throw new Error('拒绝来自未知页面的桌面操作');
    }
  };
}
