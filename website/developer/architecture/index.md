# 系统架构

Kytos 是一个本地优先的 Electron + Vue 工作区。渲染进程负责页面和交互，主进程负责文件、SQLite、模型凭据以及 AI 请求。两者之间只通过 preload 暴露的类型化 API 通信。

## 一次请求的路径

```text
Vue view / store
  -> window.desktop
  -> preload.ts (contextBridge)
  -> ipcMain.handle + trusted sender
  -> electron/services
  -> storage / providers / workspace files
```

AI 对话是另一条主进程路径：IPC handler 创建 agent，agent 调用领域工具，工具再写入服务和数据库，最后以 AI SDK UI stream 返回渲染进程。

## 目录职责

| 目录                          | 职责                             | 修改时先看             |
| ----------------------------- | -------------------------------- | ---------------------- |
| `src/views/`                  | 路由页面和页面级流程编排         | `src/router/index.ts`  |
| `src/components/sag/`         | Kytos 业务组合组件               | 对应 view 的调用方     |
| `src/components/ui/`          | shadcn-vue 原语                  | 所有调用方             |
| `src/components/ai-elements/` | AI 交互原语                      | 对应 agent 页面        |
| `src/stores/`                 | 前端跨组件状态                   | 领域 API 类型          |
| `shared/`                     | 跨进程共享的 API、模型和领域类型 | preload 与 IPC handler |
| `electron/ipc/`               | IPC 注册、参数边界和权限检查     | `electron/preload.ts`  |
| `electron/services/`          | 领域用例、持久化编排和任务状态   | 领域 schema/types      |
| `electron/storage/`           | SQLite 连接与迁移运行器          | `data/migrations`      |
| `electron/providers/`         | 聊天模型供应商适配               | `ai/providers`         |

## 设计边界

- 渲染进程不直接访问 Node.js、SQLite、文件系统或 API key。
- `shared/` 中的类型是跨边界契约，不等于数据库表结构。
- 领域规则放在 `electron/services/<domain>/`，不要在页面里拼接 IPC channel 或 SQL。
- 文件型资产和结构化元数据分开保存：数据库保存引用和状态，工作区目录保存实际图片等文件。
- 新能力必须同时考虑 IPC 类型、主进程实现、前端 loading/error 状态以及迁移或资产生命周期。

## 推荐阅读顺序

1. [环境与命令](/developer/setup)
2. [IPC 契约](/developer/architecture/ipc)
3. [前端边界](/developer/architecture/frontend)
4. [领域模型](/developer/architecture/domain-model)
5. 需要改某个功能时，再读对应的[领域流程](/developer/workflows/character)。
