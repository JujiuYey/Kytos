---
title: 相关技术教程
description: 面向已有 Web 前端基础的开发者，深入学习 Electron、SQLite、AI SDK 和 AI Elements。
---

# 相关技术教程

这一组文章只教与 Kytos 开发直接相关的技术，不解释 Kytos 的目录、业务和开发规则。每门教程都包含实战示例、边界设计和常见陷阱。

阅读这些教程前，默认你已经了解 HTML、CSS、JavaScript、Vue 3 和 TypeScript 基础。如果需要补基础，请先在站外完成对应技术的基础学习。

学完后，再进入 [Kytos 开发文档](/developer/)、[系统架构](/developer/architecture/) 等开发文档，把技术知识映射到真实项目。

## 课程顺序

| 阶段 | 教程                                            | 你会掌握什么                                      | 前置                 |
| ---- | ----------------------------------------------- | ------------------------------------------------- | -------------------- |
| 1    | [Tailwind CSS 与 shadcn-vue](./tailwind-shadcn) | utility CSS、主题 token、组件组合和可访问性       | Vue 3                |
| 2    | [Electron](./electron)                          | 主进程、渲染进程、preload、IPC、安全与发布        | TypeScript、Web 基础 |
| 3    | [SQLite](./sqlite)                              | SQL、表设计、事务、索引、migration、`node:sqlite` | TypeScript 基础      |
| 4    | [AI SDK](./ai-sdk)                              | 模型 provider、生成、流式响应、工具调用、Agent    | TypeScript、异步编程 |
| 5    | [AI Elements](./ai-elements)                    | 消息组件、输入、流式状态、工具与附件 UI           | Vue 3、AI SDK 概念   |

## 为什么是这个顺序

```text
Vue + TypeScript （已有基础）
        │
        ├── Tailwind + shadcn-vue
        │
        ├── Electron ── SQLite
        │
        └── AI SDK ── AI Elements
```

Vue 和 TypeScript 是共同前置，Tailwind 负责界面样式，Electron 提供桌面运行时，SQLite 负责本地数据，AI SDK 和 AI Elements 负责模型交互和界面。按这个顺序学，后一门课都只依赖已经建立的概念。

## 两种学习方式

### 系统学习

按 1 到 5 顺序完成。每学完一章，自己重写一遍代码，不要只阅读。如果你已经对 Vue 和 TypeScript 熟悉，可以直接从 Electron 或 AI SDK 开始。

### 按问题查阅

已经熟悉前端时，直接从遇到的问题进入：

- 不理解为什么 renderer 不能读文件：看 [Electron 的进程模型](./electron#_1-进程模型)。
- 想统一样式和组件状态：看 [Tailwind CSS 与 shadcn-vue](./tailwind-shadcn)。
- SQL 改到一半失败：看 [SQLite 事务](./sqlite#_7-事务)。
- 模型回答不是一次返回：看 [AI SDK 流式生成](./ai-sdk#_5-流式生成)。
- 聊天界面状态混乱：看 [AI Elements 的交互状态机](./ai-elements#_6-交互状态机)。

## 教程和项目文档的边界

| 你想知道                               | 去哪里                                     |
| -------------------------------------- | ------------------------------------------ |
| Electron 的 IPC 本身怎么工作           | [Electron 教程](./electron)                |
| Kytos 定义了哪些 IPC 通道              | [IPC 契约](/developer/architecture/ipc)    |
| SQLite migration 的通用设计            | [SQLite 教程](./sqlite)                    |
| Kytos 的 migration runner 和数据库划分 | [数据库与迁移](/developer/data/migrations) |
| AI SDK 如何生成文本和调用工具          | [AI SDK 教程](./ai-sdk)                    |
| Kytos 如何选 provider 和模型           | [AI 与模型集成](/developer/ai/)            |

教程回答“这项技术怎么工作”，项目文档回答“Kytos 是怎么使用它的”。
