import path from 'node:path';
import { BrowserWindow, shell } from 'electron';
import { getMainWindowUrl } from './app-protocol';

function openExternalUrl(url: string): void {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'https:') {
      void shell.openExternal(parsedUrl.toString());
    }
  } catch {
    // Ignore malformed or unsupported URLs.
  }
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const currentOrigin = new URL(window.webContents.getURL() || url).origin;
    if (new URL(url).origin !== currentOrigin) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadURL(getMainWindowUrl());
  }

  return window;
}
