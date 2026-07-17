import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, shell } from 'electron';
import type { IpcMainInvokeEvent, OpenDialogOptions } from 'electron';
import type {
  CredentialService,
  CredentialStatus,
  DesktopSettings,
  SaveFileRequest,
  SavedFileResult,
  SetCredentialRequest,
} from '../shared/desktop';

const APP_SCHEME = 'app';
const APP_HOST = 'bundle';

let mainWindow: BrowserWindow | null = null;

interface StoredSettings {
  workspacePath: string | null;
}

interface StoredSecrets {
  credentials: Partial<Record<CredentialService, string>>;
  version: 1;
}

const credentialServices: CredentialService[] = ['apimart', 'deepseek'];
let storedSettingsCache: StoredSettings | null = null;

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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isCredentialService(value: unknown): value is CredentialService {
  return credentialServices.includes(value as CredentialService);
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getSecretsFilePath(): string {
  return path.join(app.getPath('userData'), 'secrets.json');
}

function getSuggestedWorkspacePath(): string {
  return path.join(app.getPath('documents'), 'IP Creator');
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as unknown;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporaryPath, filePath);
}

async function loadStoredSettings(): Promise<StoredSettings> {
  if (storedSettingsCache) {
    return storedSettingsCache;
  }

  const value = await readJsonFile(getSettingsFilePath());
  const workspacePath =
    value &&
    typeof value === 'object' &&
    'workspacePath' in value &&
    typeof value.workspacePath === 'string' &&
    path.isAbsolute(value.workspacePath)
      ? value.workspacePath
      : null;

  storedSettingsCache = { workspacePath };
  return storedSettingsCache;
}

async function saveStoredSettings(settings: StoredSettings): Promise<void> {
  await writeJsonFile(getSettingsFilePath(), settings);
  storedSettingsCache = settings;
}

async function loadStoredSecrets(): Promise<StoredSecrets> {
  const value = await readJsonFile(getSecretsFilePath());
  const credentials: Partial<Record<CredentialService, string>> = {};

  if (value && typeof value === 'object' && 'credentials' in value) {
    const storedCredentials = value.credentials;
    if (storedCredentials && typeof storedCredentials === 'object') {
      for (const service of credentialServices) {
        if (service in storedCredentials) {
          const encryptedValue = (storedCredentials as Record<string, unknown>)[service];
          if (typeof encryptedValue === 'string') {
            credentials[service] = encryptedValue;
          }
        }
      }
    }
  }

  return { credentials, version: 1 };
}

async function ensureDirectoryWritable(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
  const directoryStat = await stat(directoryPath);
  if (!directoryStat.isDirectory()) {
    throw new Error('选择的位置不是文件夹');
  }

  const probePath = path.join(directoryPath, `.ip-creator-write-test-${randomUUID()}`);
  try {
    await writeFile(probePath, '', { flag: 'wx' });
  } finally {
    await unlink(probePath).catch((error: unknown) => {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    });
  }
}

async function setWorkspaceDirectory(workspacePath: string): Promise<DesktopSettings> {
  if (!workspacePath || !path.isAbsolute(workspacePath)) {
    throw new Error('工作区目录无效');
  }

  const normalizedPath = path.normalize(workspacePath);
  await ensureDirectoryWritable(normalizedPath);
  await mkdir(path.join(normalizedPath, 'assets'), { recursive: true });
  await saveStoredSettings({ workspacePath: normalizedPath });
  return getDesktopSettings();
}

async function getDesktopSettings(): Promise<DesktopSettings> {
  const settings = await loadStoredSettings();
  return {
    suggestedWorkspacePath: getSuggestedWorkspacePath(),
    workspacePath: settings.workspacePath,
  };
}

async function getCredentialStatus(service: CredentialService): Promise<CredentialStatus> {
  const secrets = await loadStoredSecrets();
  return {
    configured: Boolean(secrets.credentials[service]),
    secureStorageAvailable: safeStorage.isEncryptionAvailable(),
    service,
  };
}

function validateCredentialRequest(request: SetCredentialRequest): void {
  if (!request || typeof request !== 'object' || !isCredentialService(request.service)) {
    throw new Error('凭据类型无效');
  }
  if (typeof request.value !== 'string' || !request.value.trim()) {
    throw new Error('API Key 不能为空');
  }
  if (request.value.length > 16_384) {
    throw new Error('API Key 长度无效');
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
  if (!(request.fileData instanceof Uint8Array)) {
    throw new TypeError('文件内容无效');
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', async event => {
    assertTrustedSender(event);
    return getDesktopSettings();
  });

  ipcMain.handle('dialog:select-directory', async event => {
    assertTrustedSender(event);
    const settings = await getDesktopSettings();
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      defaultPath: settings.workspacePath ?? settings.suggestedWorkspacePath,
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('workspace:set-directory', async (event, workspacePath: unknown) => {
    assertTrustedSender(event);
    if (typeof workspacePath !== 'string') {
      throw new TypeError('工作区目录无效');
    }
    return setWorkspaceDirectory(workspacePath);
  });

  ipcMain.handle('workspace:use-suggested', async event => {
    assertTrustedSender(event);
    return setWorkspaceDirectory(getSuggestedWorkspacePath());
  });

  ipcMain.handle('workspace:open', async event => {
    assertTrustedSender(event);
    const settings = await loadStoredSettings();
    if (!settings.workspacePath) {
      throw new Error('尚未设置工作区目录');
    }
    const errorMessage = await shell.openPath(settings.workspacePath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  });

  ipcMain.handle('credential:get-status', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }
    return getCredentialStatus(service);
  });

  ipcMain.handle('credential:set', async (event, request: SetCredentialRequest) => {
    assertTrustedSender(event);
    validateCredentialRequest(request);
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error('系统安全存储不可用，无法安全保存 API Key');
    }

    const encryptedValue = await safeStorage.encryptStringAsync(request.value.trim());
    const secrets = await loadStoredSecrets();
    secrets.credentials[request.service] = encryptedValue.toString('base64');
    await writeJsonFile(getSecretsFilePath(), secrets);
    return getCredentialStatus(request.service);
  });

  ipcMain.handle('credential:delete', async (event, service: unknown) => {
    assertTrustedSender(event);
    if (!isCredentialService(service)) {
      throw new Error('凭据类型无效');
    }

    const secrets = await loadStoredSecrets();
    delete secrets.credentials[service];
    await writeJsonFile(getSecretsFilePath(), secrets);
    return getCredentialStatus(service);
  });

  ipcMain.handle('file:save', async (event, request: SaveFileRequest): Promise<SavedFileResult> => {
    assertTrustedSender(event);
    validateSaveFileRequest(request);

    const settings = await loadStoredSettings();
    if (!settings.workspacePath) {
      throw new Error('尚未设置工作区目录');
    }

    const storagePath = path.join(settings.workspacePath, 'assets');
    const storedFileName = createStoredFileName(request.fileName);
    const destination = path.join(storagePath, storedFileName);
    await mkdir(storagePath, { recursive: true });
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
