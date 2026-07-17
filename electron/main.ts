import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type { SaveFileRequest, SavedFileResult } from '../shared/desktop';

const APP_SCHEME = 'app';
const APP_HOST = 'bundle';

let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return (
    mainWindow !== null &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame
  );
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) {
    throw new Error('拒绝来自未知页面的桌面操作');
  }
}

function createStoredFileName(originalName: string): string {
  const extension = path.extname(originalName);
  const baseName =
    path
      .basename(originalName, extension)
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'file';

  return `${baseName}-${randomUUID().slice(0, 8)}${extension}`;
}

function validateSaveFileRequest(request: SaveFileRequest): void {
  if (!request || typeof request !== 'object') {
    throw new Error('文件参数无效');
  }
  if (!request.fileName || path.basename(request.fileName) !== request.fileName) {
    throw new Error('文件名无效');
  }
  if (!request.storagePath || !path.isAbsolute(request.storagePath)) {
    throw new Error('存储目录无效');
  }
  if (!(request.fileData instanceof Uint8Array)) {
    throw new TypeError('文件内容无效');
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('dialog:select-directory', async event => {
    assertTrustedSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = owner
      ? await dialog.showOpenDialog(owner, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('file:save', async (event, request: SaveFileRequest): Promise<SavedFileResult> => {
    assertTrustedSender(event);
    validateSaveFileRequest(request);

    const storedFileName = createStoredFileName(request.fileName);
    const destination = path.join(request.storagePath, storedFileName);
    await mkdir(request.storagePath, { recursive: true });
    await writeFile(destination, request.fileData, { flag: 'wx' });

    return {
      fileName: storedFileName,
      originalName: request.fileName,
      url: pathToFileURL(destination).toString(),
      size: request.fileData.byteLength,
      mimeType: request.mimeType || 'application/octet-stream',
    };
  });
}

function registerAppProtocol(): void {
  const rendererRoot = path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);

  protocol.handle(APP_SCHEME, request => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }

    const decodedPath = decodeURIComponent(url.pathname);
    const relativePath =
      decodedPath === '/' || path.extname(decodedPath) === ''
        ? 'index.html'
        : decodedPath.replace(/^\/+/, '');
    const filePath = path.resolve(rendererRoot, relativePath);
    const rendererRootPrefix = `${rendererRoot}${path.sep}`;

    if (
      filePath !== path.join(rendererRoot, 'index.html') &&
      !filePath.startsWith(rendererRootPrefix)
    ) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

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

function createWindow(): void {
  mainWindow = new BrowserWindow({
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

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentOrigin = new URL(mainWindow?.webContents.getURL() || url).origin;
    if (new URL(url).origin !== currentOrigin) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/`);
  }
}

app.whenReady().then(() => {
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    registerAppProtocol();
  }
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
