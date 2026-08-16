# IPC 契约

IPC 是 Kytos 的安全边界。渲染进程只能调用 `window.desktop` 上明确暴露的 API，不能拿到 `ipcRenderer` 或 Node.js 环境。

## 四个位置

| 位置                    | 作用                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `shared/desktop.ts`     | 定义 `DesktopApi` 以及各领域 API 的输入输出类型               |
| `electron/preload.ts`   | 用 `ipcRenderer.invoke` 实现 API，并通过 `contextBridge` 暴露 |
| `electron/ipc/index.ts` | 注册各领域的 `ipcMain.handle`                                 |
| `electron/ipc/*.ts`     | 在 handler 中校验 sender、调用 service、映射错误              |

`src/types/desktop.d.ts` 把同一份契约声明到渲染进程的 `window` 类型上。新增方法时，不能只改其中一个文件。

## 调用流程

```ts
// renderer
const workspace = await window.desktop.story.getWorkspace(storyId);

// preload: ipcRenderer.invoke('story:get-workspace', storyId)
// main: ipcMain.handle(...) -> story service -> database/files
```

主窗口启用 `contextIsolation`、关闭 `nodeIntegration` 并开启 `sandbox`。`electron/ipc/trusted-sender.ts` 会拒绝非应用页面发起的调用；窗口导航和外部链接也由 `electron/main-window.ts` 限制。

## 新增 IPC 能力

1. 先在 `shared/` 定义请求、响应和错误可表达的类型。
2. 在 `electron/preload.ts` 增加一个有领域前缀的 invoke 包装，不把通用 Node API 暴露出去。
3. 在对应的 `electron/ipc/<domain>.ts` 注册 handler，并先执行 trusted sender 检查。
4. handler 只做边界校验和流程编排，业务规则放进 `electron/services/<domain>/`。
5. 在 `src/types/desktop.d.ts` 确认渲染进程获得新类型。
6. 在 view/store 中处理 loading、空数据、失败和取消后的状态。
7. 检查所有 channel 名称、参数顺序和结构化克隆兼容性，再运行类型检查和构建。

## 不要这样做

- 在 Vue 文件中直接导入 `electron/*`。
- 把 API key、`Database` 实例或 Node 对象放进 IPC payload。
- 用一个无领域前缀的万能 channel 传递任意命令。
- 让 preload 暴露 `send`、`on` 等可以绕过契约的原始 IPC 方法。
