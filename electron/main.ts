import process from 'node:process';
import { app, BrowserWindow } from 'electron';
import { registerAppProtocol, registerAppScheme } from './app-protocol';
import { registerIpcHandlers } from './ipc';
import { createMainWindow } from './main-window';

// 必须在 app.whenReady() 之前注册协议 scheme
registerAppScheme();

// 用模块级变量持有窗口引用,方便 IPC 处理器访问
let mainWindow: BrowserWindow | null = null;

function openMainWindow(): void {
  mainWindow = createMainWindow();
  // 窗口关闭后释放引用,避免内存泄漏
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // ready 之后才能做需要事件循环的事
  registerAppProtocol();
  // 把窗口 getter 传给 IPC,而不是直接传窗口对象,避免闭包持有已销毁的窗口
  registerIpcHandlers(() => mainWindow);
  openMainWindow();

  // macOS 专属:点击 Dock 图标时,如果没窗口就重开
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

// 所有窗口关闭后:macOS 保持运行(由 activate 重新开窗),其他平台退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
