---
title: 认识什么是 Electron
description: 给懂 Vue 不懂 Electron 的开发者——这是什么、为什么、怎么跟 Vue 一起工作。
---

# 认识什么是 Electron

Electron 是 Kytos 运行时所在的框架。本页让"懂 Vue 不懂 Electron"的你能**在 20 分钟内建立正确的心智模型**，再开始读 [本地开发](./development)。

## 一句话总结

**Electron = Chromium + Node.js + 系统 API**——让你用网页技术（HTML / CSS / JS）写桌面应用。它运行时同时开至少两个**互不相同**的进程，这是它跟纯网页**唯一的本质区别**。

| 你熟悉的     | Electron 等价物 | 代码在哪    |
| ------------ | --------------- | ----------- |
| 浏览器标签页 | 渲染进程        | `src/`      |
| Node 后端    | 主进程          | `electron/` |

更准确地说，一个运行中的 Kytos 实例至少有：

```text
1 个主进程                ← electron/main.ts，单例，Node.js 全权限
1 个或更多渲染进程         ← 每个 BrowserWindow 一个，跑 Vue
若干 Chromium 辅助进程    ← GPU、网络、存储、DevTools 派生，通常你不用管
```

主进程**单例**，渲染进程**每个窗口一个**——后面 [进程边界](#进程边界在哪里) 一节会用到。

## 为什么会有"两个进程"

浏览器标签页是**沙箱**——不允许碰硬盘、操作系统设置、用户凭据。这些限制让你写网页安全，但**写桌面应用就什么也干不了**（不能读写文件、不能读 API Key、不能跨网络）。

Electron 的解法：

- **渲染进程** = 你熟悉的 Vue 代码（严格沙箱）
- **主进程** = Node.js 全权限（文件系统、SQLite、HTTP 调用系统库）
- **IPC** = 两者之间唯一允许的通信通道

```text
   [ Vue 页面 / Pinia store ]    ← src/（沙箱内）
            │
            │ window.desktop.foo(...)
            ▼
   [ preload 桥接 ]              ← electron/preload.ts（窄接口）
            │
            │ ipcRenderer.invoke('foo:action', args)
            ▼
   [ IPC 处理器 + 输入校验 ]     ← electron/ipc/
            │
            ▼
   [ 领域服务（SQLite / 外部 API）] ← electron/services/
```

每一层的具体职责在 [本地开发](./development) 第 2 节讲，本页只关注"为什么会这样切"。

## 进程边界在哪里

主进程和渲染进程之间是**强边界**——不是同一份内存，跨边界要序列化。

| 共享方式                                | 能不能用   | 为什么                                                    |
| --------------------------------------- | ---------- | --------------------------------------------------------- |
| 同一个 JS 对象 / 数组                   | ❌         | 进程有各自的 v8::Isolate，传过去走 structured clone 拷贝  |
| 函数 / class 实例                       | ❌         | 函数没法跨越 IPC                                          |
| 普通 JSON（对象、数字、字符串、Buffer） | ✅         | IPC 实际传的就是这类值                                    |
| 全局变量、模块作用域                    | ❌         | 渲染端看不到主进程的 `require('fs')`，反过来也是          |
| `Date` / `Map` / `Set` / `ArrayBuffer`  | ✅（受限） | structured clone 支持，但拿到的全是新实例，没有 prototype |

实战意义：**渲染端传过来的"对象"到了主进程都是新的浅拷贝**。如果 service 函数原地 mutate 它再回传，那个改动只存在于主进程这一份——Kytos 的 service 函数普遍返回新值、不原地修改，部分原因在这。

::: tip 额外的桥：preload
preload 不是独立进程，而是**渲染端进程里的一个独立 JavaScript 上下文**。它跟页面共享同一个 Chromium 进程、却跑在 v8 的另一个 isolate 里。这让你能用 `contextBridge.exposeInMainWorld` 选择性把 Node API 挂到 `window.desktop`，又不污染页面本身的全局。
:::

## 为什么不是"渲染端直接 `import 'fs'`"

历史上 Electron 默认开 `nodeIntegration: true`——渲染端能直接 `require('fs')`。这条路早被否决，是 Electron 安全模型的折中结果：

| 历史形态                  | 风险                                            | 现代默认                             |
| ------------------------- | ----------------------------------------------- | ------------------------------------ |
| `nodeIntegration: true`   | 一旦渲染端被 XSS 入侵，攻击者直接拿到 Node 权限 | 关掉，渲染端只能 `import` 渲染端代码 |
| `contextIsolation: false` | preload 直接挂到 `window` 上，页面能改它        | 打开，必须用 `contextBridge` 暴露    |
| `sandbox: false`          | 渲染端进程仍能跳出沙箱调用系统                  | 打开，让渲染端走 Chromium OS 沙箱    |

Kytos 装的是**现代默认**。看 `electron/main-window.ts:33-42`：

```ts
webPreferences: {
  contextIsolation: true,   // preload 跟页面隔离在不同 v8 上下文
  nodeIntegration: false,   // 渲染端不暴露 Node API
  preload: path.join(__dirname, 'preload.js'),
  sandbox: true,            // 走 Chromium OS 沙箱
},
```

`preload.ts:184` 的 `contextBridge.exposeInMainWorld('desktop', desktop)` 是这套默认下**唯一受支持的暴露方式**——不是风格选择，是结构决定。

## 应用从哪里启动

```text
┌──────────────────────────────────────────┐
│   macOS / Windows 启动 .app / .exe       │
└──────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────┐
│   Electron 主进程 (Node.js) = electron/main.ts │
│   - 读 package.json 的 main 字段            │
│   - app.whenReady() 后调 createMainWindow   │
│   - register 所有 IPC handler               │
│   - 监听 before-quit / window-all-closed    │
└──────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────┐
│   BrowserWindow 加载 index.html (Vite 注入) │
│   = 第一个渲染进程                            │
│   - 跑 Vue SPA                                │
│   - 注入 preload 脚本                          │
│   - 暴露 window.desktop                        │
└──────────────────────────────────────────┘
```

主进程**只能有一个**（一次应用启动一个 Node 进程）。窗口可以多个——Kytos 默认只开一个主窗口，但 DevTools、未来的"在独立窗里打开故事"都属于"再加一个渲染进程"。

macOS 关闭主窗口时**应用不退出**（约定：dock 图标保留），Windows / Linux 默认最后一个窗口关闭就退出；`electron/main.ts` 通过 `window-all-closed` 钩子处理这套平台差异。

## IPC 实际在传什么

Kytos 只用一种 IPC 通道：`invoke` 配 `handle`。

| 调用                                        | 含义                                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| `ipcRenderer.invoke('settings:set-app', x)` | 异步发到主进程等结果，返回 Promise                     |
| `ipcMain.handle('settings:set-app', ...)`   | 注册 channel 处理器，return value 自动回传             |
| `window.desktop.foo(...)`                   | preload 用 `contextBridge` 包 `invoke` 的薄壳          |
| 载荷                                        | structured clone：JSON 全集 + Date/Map/Set/ArrayBuffer |

三件容易踩坑的事：

1. **handler 抛错 → invoke 的 Promise reject**——`Error.message` 能跨进程，`Error.stack` 在某些版本上会被截断
2. **handler 是同步函数也行**——但返回值仍然要 `await`，因为 IPC 协议本身是异步消息
3. **渲染端传 `Date` / `Map` 到主进程是 deserialized 新实例**——不要在上面挂方法、不要依赖 prototype 链

> Kytos 没有用 `send` / `on`（fire-and-forget，无返回值）。如非必要，不引入。

## 关键术语速查

读 Kytos 源码会碰到这些词：

| 术语                            | 一句话                                                    | 第一次出现                            |
| ------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| **主进程 (main process)**       | Node.js 全权限的进程，开窗口、注册 IPC                    | `electron/main.ts`                    |
| **渲染进程 (renderer process)** | Chromium 里跑 Vue 的沙箱进程                              | `src/`                                |
| **BrowserWindow**               | 主进程创建的窗口对象——既是原生窗口也是 WebContents 的容器 | `electron/main-window.ts:19`          |
| **WebContents**                 | 窗口里实际的页面内容；一个 BrowserWindow 有一个           | `electron/main-window.ts`             |
| **preload**                     | 渲染端里能跑的 bridge 脚本，能用 Node API                 | `electron/preload.ts`                 |
| **contextBridge**               | 把 Node API 选择性暴露给渲染端 window 全局                | `electron/preload.ts:184`             |
| **contextIsolation**            | 把 preload 和页面隔到不同 v8 上下文的安全开关             | `electron/main-window.ts:35`          |
| **ipcRenderer / ipcMain**       | 跨进程消息发送的两端                                      | preload.ts / `ipc/`                   |
| **asar**                        | Electron 把应用代码打包成只读归档的方式                   | `forge.config.ts`                     |
| **app bundle id**               | macOS 上的反域名唯一标识                                  | `forge.config.ts`                     |
| **safeStorage**                 | 操作系统凭据存储的 Electron 封装                          | `electron/services/credentials.ts:2`  |
| **`app.getPath('userData')`**   | Electron 提供的跨平台用户数据目录                         | `electron/storage/app-database.ts:48` |
| **WAL**                         | SQLite 的预写日志模式，提速读写                           | migration 工具的 PRAGMA               |

## 安全模型

跟纯网页相比，Electron 多了一道**显式的信任边界**——渲染端代码不可信，每条消息必须验证。

```ts
// electron/ipc/settings.ts:23-29 节选
ipcMain.handle('settings:set-theme', async (event, theme: unknown) => {
  assertTrustedSender(event); // 1. 验证是主窗口的请求
  if (!isDesktopTheme(theme)) {
    // 2. 验证参数形状
    throw new TypeError('界面主题无效');
  }
  nativeTheme.themeSource = theme;
});
```

两点设计原因：

- **渲染端是 Chromium**——webview、iframe、内嵌第三方脚本**理论上能跑**。`assertTrustedSender` 把这些挡掉。
- **IPC 边界没办法信任 TS 类型**——传过来的 `theme` 就是 `unknown`，必须 narrow 再用。

## 跟纯网页相比的不同点

| 维度     | 纯网页                    | Electron                                               | 对 Kytos 的具体影响                                               |
| -------- | ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| 入口     | `index.html` 一个文件     | `package.json` 的 `main`，由 Electron 启动             | 开发命令是 `pnpm dev`，不是 `vite`；`index.html` 只是被加载的内容 |
| 网络     | 受 CORS 限制              | 主进程 `fetch` 不受 CORS 限制                          | 主进程直接打模型 API，不需要任何代理后端                          |
| 文件系统 | 无                        | 主进程 `fs` 全权限                                     | 作品目录、设置存储都跑在主进程                                    |
| 凭据     | `cookie` / `localStorage` | `safeStorage` → 操作系统 Keychain / DPAPI              | API Key 不进 git 友好的工作区目录                                 |
| 启动     | 输入 URL                  | 点 `.app` / `.exe`                                     | Kytos 只发 macOS；Windows / Linux 跑得通但没发布包                |
| 更新     | 刷新页面                  | `electron-updater` 类工具                              | 替换整个应用包，不是浏览器缓存                                    |
| 调试     | 浏览器 DevTools           | 渲染端 DevTools 一致；主进程走 VSCode / Node Inspector | Vue 错误看渲染端；主进程异常看 stderr 或断点附加                  |

## 对"懂 Vue 的你"意味着什么

**你已经会的**：

- Composition API、`<script setup>`、Pinia、Vue Router
- Vite dev server + HMR
- 跟 TypeScript 一起工作

**你会发现的新东西**：

- 写 `window.desktop.xxx()` 时要知道"这是给主进程的"
- 主进程不要塞太多业务逻辑，往 service 层搬
- 渲染端不能直接 `import 'fs'`——会立刻挂
- 主进程改动需要重启 Electron；HMR 管不到 `electron/`（见 [本地开发](./development) 第 3 节）
- `package.json` 里多两组 script——`build:web` 只打渲染端，`pnpm make` 才打桌面包

::: tip "想我现在搭一个本地 hello world 看看？"
不必。Electron Forge 的 hello world 跟 Kytos 关系不大，跑通了也无法帮你读 Kytos 的 5 层结构。直接进入 Kytos 的 [本地开发](./development) 第 2 节，"两个进程 + 5 层"——它会同时完成"理解 Electron"和"理解 Kytos"。
:::

## 下一步读

- [本地开发](./development) —— 现在开始动手：装环境、改 UI、加 IPC
- [项目架构](./architecture) —— 已有背景后回头读架构
