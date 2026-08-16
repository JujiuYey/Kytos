---
title: Kytos 开发文档
description: Kytos 当前的开发入口、架构、领域流程、数据、AI 和发布文档。
---

# Kytos 开发文档

这组文档只讲 Kytos 这个项目现在怎么工作，不重复教 Electron、SQLite、AI SDK 或 Vue 基础。技术本身请看 [相关技术教程](/tutorial/)。

::: warning 先看这一页
项目的真实行为以源码为准。文档中的路径和模块名是定位代码的入口，不保证细节与你当前分支的未提交改动一致。
:::

## 开始一次开发

1. 先阅读 [环境与命令](./setup)，确认本地运行、构建和检查方式。
2. 遇到不知道该改哪一层时，阅读 [系统架构](./architecture/)和 [IPC 边界](./architecture/ipc)。
3. 遇到具体功能时，先读对应的[领域流程](./workflows/character)。
4. 修改数据、Agent 或发布链路时，分别进入 [数据](./data/)、[AI](./ai/)、[构建](./release/build)。

## 文档地图

| 你要解决的问题                 | 文档                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------- |
| 如何启动、调试和验证           | [环境与命令](./setup)                                                        |
| 为什么这个功能要跨哪些层       | [系统架构](./architecture/)                                                  |
| 新增一个渲染端能力需要哪些契约 | [IPC 边界](./architecture/ipc)                                               |
| 路由、页面和状态该放在哪里     | [渲染端结构](./architecture/frontend)                                        |
| 角色、插画或故事的真实数据流   | [领域模型](./architecture/domain-model) 和 [领域流程](./workflows/character) |
| 改数据表或 migration           | [数据边界](./data/)                                                          |
| 改聊天模型、Agent 或生图       | [AI 集成](./ai/)                                                             |
| 构建和发布应用                 | [构建](./release/build) 与 [发布](./release/publish)                         |

## 不要把这里当作规范副本

- 代码风格、强制组件来源、滚动约束和验证要求以仓库根目录 `AGENTS.md` 为准。
- 模型、供应商和发布状态是可变信息，修改代码时要同时检查对应的 `shared/`、`electron/` 和 `package.json`。
- 文档中不保留“未来可能做”的个人待办事。路线和想法应进 issue 或里程碑，不与当前操作手册混在一起。
