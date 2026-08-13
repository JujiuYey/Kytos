---
title: 项目架构
description: 理解 Kytos 的 Electron、Vue、IPC 和本地数据边界。
---

# 项目架构

Kytos 是 Electron Forge + Vite + Vue 3 桌面应用。核心原则是让渲染端负责界面和流程编排，让主进程负责文件、数据库、系统能力和外部服务访问。

## 运行时边界

```text
Vue renderer (src/)
        │
        │ window.desktop
        ▼
Preload allowlist (electron/preload.ts)
        │
        │ ipcRenderer.invoke(...)
        ▼
IPC handlers (electron/ipc/)
        │
        ├── domain services (electron/services/)
        ├── agents (electron/agents/)
        ├── SQLite storage (electron/storage/)
        └── external model providers
```

Vue 代码不直接导入 Electron、Node 文件系统或数据库模块。所有跨进程能力都应先定义共享契约，再通过 preload 的窄接口暴露。

## 主要目录

| 目录                          | 职责                                               |
| ----------------------------- | -------------------------------------------------- |
| `electron/main.ts`            | 应用生命周期、协议注册、IPC 注册和主窗口创建       |
| `electron/preload.ts`         | 把允许的 IPC 调用按领域暴露为 `window.desktop`     |
| `electron/ipc/`               | 校验和接收渲染端请求，转交领域服务                 |
| `electron/services/`          | 角色、视觉、表情、插画、故事、工作区和凭据业务逻辑 |
| `electron/agents/`            | 插画和故事的受约束共创 Agent                       |
| `electron/storage/`           | 应用级与工作区 SQLite 连接、migration              |
| `shared/`                     | 主进程、preload 和渲染端共享的类型与协议           |
| `src/views/`                  | 按路由功能组织的 Vue 页面                          |
| `src/components/ui/`          | shadcn 风格通用 UI 原语                            |
| `src/components/ai-elements/` | 对话、消息、提示输入等 AI 交互原语                 |
| `src/components/sag/`         | Kytos 应用级业务组合组件                           |

## `window.desktop` API

preload 当前按以下领域聚合：

```text
window.desktop
├── character
│   ├── library
│   ├── assets
│   ├── expression
│   └── visual
├── illustration
├── story
├── settings
└── file
```

新增跨进程能力时，应同步更新：

1. `shared/` 中的请求、响应和 API interface。
2. `electron/preload.ts` 中的允许调用。
3. `electron/ipc/` 中的处理器和输入校验。
4. 对应 `electron/services/` 领域实现。
5. `src/types/desktop.d.ts` 或相关全局类型入口。

不要把通用 IPC 请求器暴露给渲染端，也不要让页面自行拼接 channel 名称。

## 数据库边界

应用级数据库位于 Electron 用户数据目录，保存工作区路径、主题、模型设置和加密凭据。

工作区数据库位于用户选择的作品目录，保存角色、资产记录、生成任务、插画和故事。切换工作区时，数据库模块会关闭旧连接并连接新路径。

这种拆分使模型凭据不会进入作品目录，也使不同工作区可以维护各自独立的创作数据。

## 本地资源协议

工作区图片不会直接暴露为任意 `file://` 地址。主进程注册应用协议，把允许的工作区资产转换为渲染端可用 URL，并在服务层校验文件路径和资源类别。
