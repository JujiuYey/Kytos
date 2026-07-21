// IPC handler 的可信发送方守卫
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

// 取得主窗口的工厂
type MainWindowProvider = () => BrowserWindow | null;

// 守卫函数：拒绝时抛错
export type TrustedSenderGuard = (event: IpcMainInvokeEvent) => void;

// 创建守卫：只接受来自主窗口 webContents 与主 frame 的 IPC
export function createTrustedSenderGuard(getMainWindow: MainWindowProvider): TrustedSenderGuard {
  return event => {
    const mainWindow = getMainWindow();
    const isTrusted =
      mainWindow !== null &&
      // 同一 webContents
      event.sender === mainWindow.webContents &&
      // 且是顶层 frame，挡住 webview/iframe
      event.senderFrame === mainWindow.webContents.mainFrame;

    if (!isTrusted) {
      throw new Error('拒绝来自未知页面的桌面操作');
    }
  };
}