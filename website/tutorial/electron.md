---
title: Electron 完整教程
description: 从桌面窗口到主进程、preload、IPC、安全和发布。
---

# Electron 完整教程

Electron 把 Chromium 和 Node.js 组合成桌面应用运行时。Chromium 负责界面，Node.js 负责文件、窗口和操作系统能力。

学 Electron 的关键不是记 API，而是理解进程和信任边界。

## 1. 进程模型

```text
Main process
  │  创建窗口、访问系统、保管本地能力
  │
  ├─ BrowserWindow A ─ Renderer process A
  └─ BrowserWindow B ─ Renderer process B
```

- **Main process**：应用入口，管理生命周期、窗口、菜单、文件和系统 API。
- **Renderer process**：每个页面在独立 Chromium 上下文运行，应像普通 Web 页面一样对待。
- **Preload script**：在页面加载前运行，向 renderer 暴露一个受控的窄 API。

```text
Renderer 不可信
   ↓ 只能调用明确列出的能力
Preload allowlist
   ↓ IPC
Main 验证来源和参数后执行
```

## 2. 创建 Electron Forge 项目

Electron Forge 管理开发、打包和分发：

```bash
pnpm create electron-app desktop-notes --template=vite-typescript
cd desktop-notes
pnpm start
```

项目的三个关键入口：

```text
src/main.ts       主进程
src/preload.ts    preload
src/renderer.ts   渲染进程
```

模板细节会随 Forge 版本变化，三者的责任不变。

## 3. 应用生命周期和窗口

```ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return window;
}

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

macOS 上关闭所有窗口后应用通常仍运行，点击 Dock 图标时重建窗口。Windows/Linux 上通常关闭最后一个窗口就退出。

## 4. 为什么 renderer 不直接使用 Node.js

不要这样配置：

```ts
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
}
```

页面一旦发生脚本注入，攻击代码就能读取任意文件或窃取密钥。正确模式是让 renderer 保持 Web 沙箱思维，所有系统能力通过受控 IPC 请求。

## 5. 第一个类型安全 IPC

目标：选择 Markdown 文件，将文本返回页面。

### 共享契约

```ts
export interface OpenTextFileResult {
  filePath: string;
  content: string;
}

export interface DesktopApi {
  file: {
    openText(): Promise<OpenTextFileResult | null>;
  };
}
```

### preload 只暴露明确方法

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from './shared/desktop-api';

const desktopApi: DesktopApi = {
  file: {
    openText: () => ipcRenderer.invoke('file:open-text'),
  },
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
```

不要暴露整个 `ipcRenderer`，否则 renderer 可以调用任意 channel，preload 便失去 allowlist 作用。

### main 处理器

```ts
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';

export function registerFileHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('file:open-text', async event => {
    if (event.sender !== mainWindow.webContents) {
      throw new Error('Untrusted IPC sender');
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      properties: ['openFile'],
    });

    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) return null;
    return { filePath, content: await readFile(filePath, 'utf8') };
  });
}
```

### renderer 调用

```ts
const result = await window.desktop.file.openText();
if (result) editor.value = result.content;
```

renderer 只知道 `window.desktop.file.openText()`，不知道 channel 名、文件系统 API 或 dialog 实现。

## 6. IPC 的三种模式

| 模式       | API                                     | 适合                     |
| ---------- | --------------------------------------- | ------------------------ |
| 请求/响应  | `ipcRenderer.invoke` + `ipcMain.handle` | 读文件、查数据、保存设置 |
| 单向命令   | `ipcRenderer.send` + `ipcMain.on`       | 不需要结果的信号         |
| 主进程事件 | `webContents.send` + preload listener   | 下载进度、系统主题变化   |

默认优先 `invoke/handle`，Promise 结果和错误边界最清晰。只有由 main 主动产生的持续事件才需要 listener。

### 订阅必须可取消

```ts
const desktopApi = {
  download: {
    onProgress(callback: (progress: number) => void) {
      const listener = (_event: Electron.IpcRendererEvent, progress: number) => callback(progress);
      ipcRenderer.on('download:progress', listener);
      return () => ipcRenderer.removeListener('download:progress', listener);
    },
  },
};
```

返回 cleanup 函数，让组件卸载时取消订阅。

## 7. IPC 参数要运行时验证

TypeScript 类型在运行时不存在。main 收到的数据仍然不可信：

```ts
interface SaveFileInput {
  filePath: string;
  content: string;
}

function isSaveFileInput(value: unknown): value is SaveFileInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return typeof input.filePath === 'string' && typeof input.content === 'string';
}
```

除了形状，还要验证路径是否在允许范围、文件大小、枚举值、ID 格式和操作权限。

## 8. 主进程不等于业务逻辑容器

```text
main.ts
  ↓ register handlers
ipc/file.ts
  ↓ validate and delegate
services/document-service.ts
  ↓ business rules
storage/document-store.ts
```

main 入口编排生命周期，IPC handler 处理边界，service 处理业务。service 不应依赖 `IpcMainInvokeEvent`，这样菜单、快捷键和后台任务也能复用它。

## 9. 菜单与快捷键

```ts
import { Menu } from 'electron';

Menu.setApplicationMenu(
  Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [{ role: 'close' }, { type: 'separator' }, { role: 'quit' }],
    },
    {
      label: '编辑',
      submenu: [{ role: 'undo' }, { role: 'redo' }, { role: 'copy' }, { role: 'paste' }],
    },
  ]),
);
```

优先使用 Electron `role`，它会适配平台菜单名称和默认快捷键。

## 10. 本地文件与应用数据

```ts
const userDataDirectory = app.getPath('userData');
```

`userData` 适合应用配置、缓存和本地数据库。用户明确创建的文档应放在用户选择的路径。

路径安全不能只检查字符串前缀。使用 `path.resolve`、`path.relative` 和允许根目录判断路径是否越界。

## 11. 安全基线

1. `contextIsolation: true`。
2. `nodeIntegration: false`。
3. renderer 不能获得整个 `ipcRenderer`。
4. 每个 IPC handler 验证 sender 和参数。
5. 不对不可信内容开启导航、新窗口或 shell 执行。
6. 不把 API Key 发到 renderer。
7. 为加载内容配置 CSP，尽量不执行远程代码。
8. 外部 URL 经过协议和域名检查后再交给系统浏览器。

## 12. 调试

| 问题                        | 去哪看                                    |
| --------------------------- | ----------------------------------------- |
| Vue 渲染、CSS、页面事件     | renderer DevTools                         |
| main、IPC handler、文件系统 | 启动 Electron 的终端或 Node inspector     |
| preload 暴露失败            | preload 路径、构建产物和 renderer console |
| 开发正常、打包失败          | 静态资源路径、asar、平台条件和未打包文件  |

renderer HMR 通常可局部更新，main/preload 改动往往需要重启 Electron。

## 13. 打包与发布

```bash
pnpm package
pnpm make
```

- `package` 整理可运行应用目录。
- `make` 调用 maker 生成 zip、dmg、deb 或 Windows 安装产物。

对外发布还涉及应用 ID、图标、版本号、升级策略、macOS notarization、Windows 签名、CPU 架构以及干净机器验收。“本地能启动”和“可以安全分发”是两个阶段。

## 14. 常见错误

| 错误                           | 改法                     |
| ------------------------------ | ------------------------ |
| renderer 直接访问 `fs`         | 通过 preload 的窄 API    |
| preload 暴露整个 `ipcRenderer` | 一个业务能力对应一个方法 |
| main 相信 TypeScript 参数类型  | 做运行时验证             |
| listener 只注册不清理          | preload 返回 cleanup     |
| IPC handler 堆满业务逻辑       | handler 验证后调 service |
| 只测开发模式                   | 在干净环境验证打包产物   |

## 15. 练习

创建一个桌面 Markdown 编辑器：

1. renderer 显示编辑器和文件状态。
2. preload 暴露 `openText()` 和 `saveText(input)`。
3. main 验证 sender、输入类型和文件扩展名。
4. 菜单提供打开、保存和退出，与界面共享同一 service。
5. 关闭未保存文件时给出确认。
6. 确认 renderer 中无法导入 `node:fs`。

下一步学习 [SQLite](./sqlite)，为桌面应用添加可查询的结构化本地数据。
