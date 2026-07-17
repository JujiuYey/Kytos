import process from 'node:process';
import { app, BrowserWindow } from 'electron';
import { registerAppProtocol, registerAppScheme } from './app-protocol';
import { registerIpcHandlers } from './ipc';
import { createMainWindow } from './main-window';

registerAppScheme();

let mainWindow: BrowserWindow | null = null;

function openMainWindow(): void {
  mainWindow = createMainWindow();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    registerAppProtocol();
  }
  registerIpcHandlers(() => mainWindow);
  openMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
