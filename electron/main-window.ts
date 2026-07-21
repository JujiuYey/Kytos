// 主窗口创建与外部链接安全策略
import path from 'node:path';
import { BrowserWindow, shell } from 'electron';
import { getMainWindowUrl } from './app-protocol';

// 仅打开 https 协议的外部链接，其他静默忽略
function openExternalUrl(url: string): void {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'https:') {
      void shell.openExternal(parsedUrl.toString());
    }
  } catch {
    // 忽略格式非法或不支持的 URL
  }
}

// 创建主窗口
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    // 窗口标题
    title: 'Kytos',
    // 初始宽度
    width: 1200,
    // 初始高度
    height: 800,
    // 最小宽度
    minWidth: 800,
    // 最小高度
    minHeight: 600,
    // 初始隐藏，等 ready-to-show 再显示，避免白屏闪烁
    show: false,
    webPreferences: {
      // 开启上下文隔离（preload 与渲染端 JS 不共享全局）
      contextIsolation: true,
      // 禁用渲染端直接访问 Node.js
      nodeIntegration: false,
      // preload 脚本路径（负责 IPC 桥接）
      preload: path.join(__dirname, 'preload.js'),
      // 启用 sandbox，进一步限制渲染端权限
      sandbox: true,
    },
  });

  // 页面渲染就绪后再显示窗口
  window.once('ready-to-show', () => {
    window.show();
  });

  // 拦截 window.open：仅放行 https 外部跳转，主窗口内一律拒绝
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  // 拦截页面内 <a> 跳转：非同源走外部浏览器
  window.webContents.on('will-navigate', (event, url) => {
    const currentOrigin = new URL(window.webContents.getURL() || url).origin;
    if (new URL(url).origin !== currentOrigin) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  // 开发环境走 vite dev server，生产环境走 app:// 协议
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadURL(getMainWindowUrl());
  }

  return window;
}