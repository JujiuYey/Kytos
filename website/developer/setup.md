---
title: 环境与命令
description: Kytos 的开发环境、启动、构建、检查和常用调试入口。
---

# 环境与命令

## 环境要求

- Node.js 22.12+
- pnpm 10
- 可运行 Electron 的 macOS、Windows 或 Linux 桌面环境

依赖安装由开发者自己完成：

```bash
pnpm install
```

## 开发模式

```bash
pnpm dev
```

`pnpm dev` 运行 Electron Forge + Vite。`src/` 中的 Vue 和渲染端代码通常可以 HMR；`electron/` 中的主进程、preload 和 IPC 改动需要重启应用。

## 验证命令

| 目的                  | 命令                                      |
| --------------------- | ----------------------------------------- |
| 只构建 Web 和类型检查 | `pnpm build:web`                          |
| 对指定文件做 lint     | `pnpm exec oxlint <changed-files>`        |
| 检查指定文件格式      | `pnpm exec oxfmt --check <changed-files>` |
| 检查 diff 空白错误    | `git diff --check`                        |
| 构建文档              | `pnpm docs:build`                         |

`pnpm build:web` 是前端代码改动的最小完整检查。只改文档时运行 `pnpm docs:build`。根据 `AGENTS.md` 的约束，代理不启动 Electron、浏览器或截图做视觉验收。

## 常用调试位置

| 现象                                | 先看哪里                                     |
| ----------------------------------- | -------------------------------------------- |
| Vue、CSS、渲染、点击事件错误        | renderer DevTools                            |
| `window.desktop` 不存在或方法不存在 | `electron/preload.ts` 和 `shared/desktop.ts` |
| IPC 请求失败                        | 对应 `electron/ipc/*.ts` 和主进程终端        |
| 数据库查询、文件和模型请求失败      | 对应 `electron/services/`                    |
| 生成任务一直不完成                  | 对应领域的 `generation.ts` 和任务状态        |

## 开发完成前

1. 确认改动只触及预期文件。
2. 根据改动范围运行最小检查。
3. 确认异步操作有 loading、empty、error 和 disabled 状态。
4. 确认新的跨进程能力已经经过 [IPC 边界](./architecture/ipc) 和对应领域流程。
5. 提交前运行 `git diff --check`。
