---
title: 本地开发
description: 从 git clone 到第一个 PR：跑起来、改 UI、加 IPC、加页面、验证、提交。
---

# 本地开发

本教程面向**懂 Vue 3 + TypeScript 但没接触过 Electron** 的贡献者。学完你能：

- 把 Kytos 跑起来，按 HMR 验证改动
- 在脑子里画出"两个进程"模型
- 跟着 5 层结构给一个新功能加 IPC 通道
- 提交一个会通过 CI 的 PR

仓库约束见 [`AGENTS.md`](https://github.com/JujiuYey/Kytos/blob/main/AGENTS.md)；本教程不重复约束，只讲"该怎么做第一次"。

## 1. 让项目跑起来

**环境要求**：Node.js 22.12+、pnpm 10、可运行 Electron 的桌面环境（macOS / Windows / Linux 桌面版）。

```bash
git clone https://github.com/JujiuYey/Kytos.git
cd Kytos
pnpm install
pnpm dev
```

启动后应该看到 Kytos 桌面窗口，呈现角色库或设置页面。第一次启动会要求选择作品工作区，建议先用默认推荐目录。

::: tip HMR 是活的
`pnpm dev` 启动的是 Electron Forge + Vite 开发环境。改 `src/` 下的代码（包括 Vue SFC）会通过 Vite HMR 热更新，不用重启 Electron。
:::

## 2. 写 Vue 代码的人第一件要懂的事：两个进程

**Kytos 是 Electron 应用，不是网页**。Electron 同时跑两个东西：

| 进程     | 做什么                                   | 写在哪儿    |
| -------- | ---------------------------------------- | ----------- |
| 主进程   | 操作系统、文件系统、SQLite、外部模型 API | `electron/` |
| 渲染进程 | Vue 页面、AI 对话 UI、Pinia store        | `src/`      |

两进程**不能直接共享内存**，只能通过 **IPC（进程间通信）** 互发消息。Renderer 不允许直接 `import fs`、不允许直接访问数据库——所有跨进程能力都要走一条窄接口。

### 5 层结构

```text
[ Vue 页面 / Pinia store ]         ← src/
        │
        │ window.desktop.settings.setAppSettings(...)
        ▼
[ preload 桥接层 ]                  ← electron/preload.ts
        │
        │ ipcRenderer.invoke('settings:set-app', settings)
        ▼
[ IPC 处理器 + 输入校验 ]           ← electron/ipc/
        │
        ▼
[ 领域服务（含 SQLite / 外部 API） ] ← electron/services/
        │
        ▼
[ 共享契约 + 类型 ]                 ← shared/
```

**记住这条线**——下面第 4 节，你会照着这条线把一个新方法从 "shared 类型" 一路接通到 "Vue 页面调用"。

## 3. 第一次改 UI：动一个文案

最安全的练手：改一处已经渲染过的字面量。

打开 `src/views/character/index.vue`（或任何一个 `src/views/**/*.vue`），找一个文案字符串直接改一两个字，按 Ctrl+S 保存。你会看到窗口里相应位置**立即**变化——这就是 HMR，不必重启。

改完什么都不用做，验证步骤见第 6 节。

::: warning 不要改 `electron/` 期待 HMR
主进程改动需要**重启 Electron**（退出 `pnpm dev` 再启动）。`pnpm build:web` 不涉及主进程，**看不到**主进程错误。
:::

## 4. 第一次加 IPC：走通 5 个文件

要做的练习：加一个演示方法 `getNow()`，从渲染端调到主进程拿到数据库当前时间。

为了让你看到"真实代码长什么样"，下面 4.1-4.4 用 **`setAppSettings`**（已存在）来对照。每段都给了 file:line 引用，**用编辑器跳转看完整上下文**比复制粘贴有用。

### 4.1 共享契约：`shared/settings.ts`

每个跨进程方法的**类型签名**都集中在这里。`SettingsApi` 是渲染端看到的形状：

```ts
// shared/settings.ts:48-69 节选
export interface SettingsApi {
  // 保存应用模型与界面设置
  setAppSettings: (settings: AppSettings) => Promise<AppSettings>;
  // 设置主题
  setTheme: (theme: DesktopTheme) => Promise<void>;
  // ... 其余 7 个方法
}
```

加新方法时**先在这里加类型**，所有层会跟着单一来源流动。

### 4.2 preload 桥接：`electron/preload.ts`

preload 拿到 shared 里的接口，**逐个方法**包成 `ipcRenderer.invoke`：

```ts
// electron/preload.ts:136-158 节选
const settingsApi: SettingsApi = {
  // 保存应用模型与界面设置
  setAppSettings: settings => ipcRenderer.invoke('settings:set-app', settings),
  // 设置主题
  setTheme: theme => ipcRenderer.invoke('settings:set-theme', theme),
  // ...
};
```

三点要记住：

1. **不引入业务逻辑**——preload 只是管道，校验放 IPC 层
2. **channel 名统一加前缀**——`settings:set-app`、`credential:set` 都是 `<域>:<动作>`
3. **`Promise<...>` 是 `ipcRenderer.invoke` 自带的**，不要再 wrap

### 4.3 IPC 处理器 + 输入校验：`electron/ipc/settings.ts`

每个 handler 都**先验证发送方**（挡 webview / iframe / 外部页面），再做输入校验：

```ts
// electron/ipc/settings.ts:23-35 节选
ipcMain.handle('settings:set-theme', async (event, theme: unknown) => {
  assertTrustedSender(event);
  if (!isDesktopTheme(theme)) {
    throw new TypeError('界面主题无效');
  }
  nativeTheme.themeSource = theme;
});

ipcMain.handle('settings:set-app', async (event, settings: AppSettings) => {
  assertTrustedSender(event);
  return saveAppSettings(settings);
});
```

::: warning 类型收窄不要跳过
`theme: unknown` 是必须的——IPC 边界无法相信渲染端传来的形状。每个 handler 都**先校验再使用**，否则信任链就交到了最前端。
:::

### 4.4 领域实现：`electron/services/workspace/settings.ts`

业务逻辑住这里。看一个具体的服务函数：

```ts
// electron/services/workspace/settings.ts:46-62 节选
export function saveAppSettings(settings: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(settings);
  getApplicationDatabase()
    .prepare(
      `UPDATE application_settings
       SET theme = ?, deepseek_model = ?, fastseek_model = ?, general_model = ?, image_model = ?
       WHERE id = 1`,
    )
    .run(
      normalized.theme,
      normalized.deepseekModel,
      normalized.fastModel,
      normalized.generalModel,
      normalized.imageModel,
    );
  return normalized;
}
```

服务函数都是**纯函数 + 显式依赖**（DB 句柄、外部 API client 走入参或模块级单例），**别在这里塞 IPC**。

::: tip 这一步改完要重启 Electron
主进程代码改了，`pnpm dev` 退出再启动一次才生效（HMR 管不到主进程）。Service-only 改动不需要再跑 `pnpm build:web`。
:::

### 4.5 全局类型：`src/types/desktop.d.ts`

`window.desktop` 在 TS 里的类型来自这里。一共 9 行：

```ts
// src/types/desktop.d.ts
import type { DesktopApi } from '../../shared/desktop';

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

export {};
```

`DesktopApi` 在 `shared/desktop.ts` 中聚合，**单一来源是 `shared/`**。改 `SettingsApi` 后这里自动跟上，不用手改。

### 4.6 在 Vue 页面里调用

```vue
<script setup lang="ts">
async function onSaveClick(): Promise<void> {
  const next = await window.desktop.settings.setAppSettings({/* AppSettings 形状 */});
  console.log('已保存', next);
}
</script>

<template>
  <Button @click="onSaveClick">保存设置</Button>
</template>
```

保存后 HMR 应该立刻生效，**你会在 DevTools console 看到 `已保存` 日志**。Pinia store 里如果不自动同步，需要自己起一个简单 store 监听。

## 5. 加一个新的 Vue 页面

完整做法 5 步：

```text
1.  建文件: src/views/<feat>/index.vue
2.  在 src/router/ 里加路由（路由文件以功能命名）
3.  如果是新域类型: 加 shared/ + 服务 + IPC + preload（回第 4 节）
4.  引用 src/components/ui/ 和 src/components/ai-elements/
5.  如果有持久化状态: src/stores/<name>.ts
```

页面级规范见 AGENTS.md。三个常见误区：

- **不要自己写交互组件**：Button、Dialog、Dropdown、Tabs、ScrollArea 全部在 `src/components/ui/` 已经有
- **聊天 / AI 输入**：用 `src/components/ai-elements/` 的 `Conversation`、`PromptInput`、`Reasoning`、`Loader`，不另起
- **图标用 `@lucide/vue`**：`<HardDrive />`、`<Sparkles />` 都从 lucide 拿，不要手写 SVG

## 6. 验证（5-10 分钟）

改动多大，跑多少。按 AGENTS.md "最小且充分" 原则：

```bash
# 必跑：build 同时跑类型检查（vue-tsc）
pnpm build:web

# 改了 .ts/.vue 都要跑
pnpm exec oxlint <changed-files>
pnpm exec oxfmt --check <changed-files>

# 提交前
git diff --check
```

`pnpm build:web` 这一步**比 lint 更重要**——类型错了构建直接挂。

::: danger 别自己跑 `pnpm make` 做视觉验收
AGENTS.md 明确："禁止代码代理主动启动 Electron、开发服务器或浏览器进行视觉验收。" 视觉验收由开发者手动完成。
:::

## 7. 提交并发起 PR

提交信息用 conventional commits（仓库历史一致）：

```text
feat(<scope>): <动词> <具体内容>
fix(<scope>): ...
docs(<scope>): ...
refactor(<scope>): ...
```

`<scope>` 用功能域：`chat`、`illustration`、`story`、`character`、`settings`、`workspace` 等。

```bash
git checkout -b feat/<scope>/<短描述>
git add <files>
git commit -m "feat(illustration): add batch delete for versions"
git push origin feat/illustration/batch-delete
```

GitHub 上开 PR，描述里写三件事：

1. **改了啥**：对应文件 / 逻辑
2. **为什么**：动机一句话
3. **怎么验**：本地怎么跑、要看什么

## 顺手读

- [项目架构](./architecture) —— 跟着一条用户操作读 5 层代码
- [AGENTS.md](https://github.com/JujiuYey/Kytos/blob/main/AGENTS.md) —— 仓库约束的完整清单
