---
title: 认识 ai-sdk 和 ai-elements
description: Kytos AI 工作流的两块基石——ai-sdk 做对话运行，ai-elements 做对话 UI。
---

# 认识 ai-sdk 和 ai-elements

Kytos 的 AI 工作流由两组库分工完成：**ai-sdk** 处理"跟模型说话"，**ai-elements** 处理"对话怎么渲染"。本页让"懂 Vue 但没碰过 AI 工具链"的人在 20 分钟内搞清两者角色。

## 一句话总结

| 库              | 干什么                                    | 装在                |
| --------------- | ----------------------------------------- | ------------------- |
| **ai-sdk**      | 跟大模型对话：发请求、流式接收、工具调用  | 渲染端 + 主进程都用 |
| **ai-elements** | 对话 UI：消息气泡、输入框、推理过程、附件 | 仅渲染端            |

前者是**数据层**（Vercel 出品的 LLM 工具链），后者是**UI 层**（shadcn-vue 风格的 AI 组件集合）。两者不直接依赖，但**实际工作时**：ai-sdk 拿到流，喂给 ai-elements 的对话组件。

::: warning ai-elements ≠ Vercel AI Elements
Vercel AI Elements 是 React 包。Kytos 的 `ai-elements/` 是 shadcn-vue 一族组件，**命名相近、灵感相通，但实现是 Vue 写的**（对照 `components.json` 是 shadcn-vue CLI 配置）。
:::

## ai-sdk 是什么

Vercel AI SDK——一组 TypeScript 库。Kytos 用了三个相关包：

| 包                          | 干什么                                                                             | 用在                    |
| --------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| `ai`                        | 核心：`streamText`、`generateText`、`ToolLoopAgent`、`createAgentUIStreamResponse` | 主进程 agent            |
| `@ai-sdk/openai-compatible` | OpenAI 兼容协议 provider 工厂                                                      | `electron/providers/`   |
| `@ai-sdk/vue`               | Vue 响应式 hook：`useChat`                                                         | `src/views/*/index.vue` |

三层分工：

```text
[ 渲染端 src/views/*/index.vue ]
        │
        │ useChat()   ← @ai-sdk/vue
        │ （UI message stream 协议）
        ▼
[ 主进程 electron/agents/<name>-agent/route.ts ]
        │
        │ createAgentUIStreamResponse
        ▼
[ agent.ts: ToolLoopAgent + createChatLanguageModel ]
        │
        ▼
[ electron/providers/chat-provider.ts → createOpenAICompatible ]
        │
        ▼
[ DeepSeek / MiniMax / ... ]
```

### 实际看 Kytos 代码

**主进程入口**——`electron/providers/chat-provider.ts:14-19`：

```ts
export function createChatLanguageModel(apiKey: string, model: ChatModel) {
  if (getChatModelProvider(model) === 'minimax') {
    return createMinimaxCompatibleProvider(apiKey)(model);
  }
  return createDeepSeekCompatibleProvider(apiKey)(model);
}
```

返回 ai-sdk 认识的 `LanguageModel`。

**Agent 编排**——`electron/agents/illustration-agent/agent.ts` 用 `ToolLoopAgent` 把模型、工具、指令组装起来：

```ts
// electron/agents/illustration-agent/agent.ts 节选
import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { createChatLanguageModel, getChatProviderOptions } from '../../providers/chat-provider';
import { z } from 'zod';

const briefPatchSchema = z.object({/* ... 字段 ... */});

const illustrationAgent = new ToolLoopAgent({
  model: createChatLanguageModel(apiKey, model),
  tools: { updateBrief: tool({ inputSchema: briefPatchSchema /* ... */ }) },
  // ...
});
```

**渲染端消费**——`src/views/illustration/index.vue:6, 339`：

```ts
import { useChat } from '@ai-sdk/vue';
const { messages, sendMessage, status } = useChat<IllustrationAgentMessage>({
  // 路由 / transport / 回调
});
```

`messages` 是响应式数组，`status` 标流式状态，UI 用这些数据驱动 ai-elements 组件。

## ai-elements 是什么

**shadcn-vue 风格的 AI 对话组件集合**，装在 `src/components/ai-elements/`。AGENTS.md 写得很死：

> AI 对话必须优先使用 `Conversation`、`Message`、`PromptInput`、`Reasoning`、`Loader` 等 `ai-elements` 组件，不另写一套聊天气泡和输入框。

简而言之：**禁止自己写聊天气泡**。

主要组件（按出现频率）：

| 组件                                   | 作用                          |
| -------------------------------------- | ----------------------------- |
| `Conversation` / `ConversationContent` | 整段对话容器，自动滚到底      |
| `Message` / `MessageContent`           | 一条消息气泡（用户 / 模型）   |
| `PromptInput` / `PromptInputTextarea`  | 用户输入框（支持附件 / 提交） |
| `Reasoning`                            | 折叠展开模型的"思考过程"      |
| `Loader`                               | "AI 在想"加载动画             |
| `Attachment`                           | 附件缩略图                    |

`src/components/ai-elements/` 下还有约 50 个目录：agent、artifact、canvas、checkpoint、code-block、sources、tool 等——是"AI 工具栈美学"的延伸，按需引入。

## 两者怎么协同工作

简化 illustration 页一次完整交互：

```text
1. 用户在 <PromptInput> 输入
2. 提交 → useChat.sendMessage(...)
3. useChat 把消息经自定义 transport 发到主进程
4. 主进程 route.ts 调 illustrationAgent.stream(...)
5. ToolLoopAgent 用 ai-sdk streamText 跟 LLM 对话
6. UI message stream chunk 一段段回到渲染端
7. messages 响应式数组更新
8. <Conversation> 重新渲染，<Message> 增量追加
9. <Reasoning> 显示"思考过程"，最后 <Loader> 消失
```

::: warning 不要在主进程外做 AI 推理
API Key 在主进程的凭据存储里（`safeStorage`），不会回传到渲染端。**任何 `ai-sdk` 的 model 调用必须在主进程**——渲染端只通过 `useChat` 等 hook 间接消费。
:::

## 对"懂 Vue 不懂 AI 工具链的你"意味着什么

**你已经会的**：Vue 组件、props / slot、组合式 API。

**你会发现的新东西**：

- **流式数据**：不是 `string`，是异步 chunk 流
- **状态机**：`status` 字段（`submitted` / `streaming` / `ready` / `error`）驱动 UI
- **Zod schema**：agent 输出经常用 zod 校验，跟表单是同套工具
- **`useChat` 协议**：跟 `createAgentUIStreamResponse` 是配对的

## "我应该加新功能时怎么用"

| 想做什么             | 用                                                                            |
| -------------------- | ----------------------------------------------------------------------------- |
| 加一段新的对话 UI    | 直接用 `src/components/ai-elements/` 现有组件，按 props 接数据                |
| 让模型跟用户多轮对话 | 在 `electron/agents/<name>-agent/` 加新 agent，复用 `createChatLanguageModel` |
| 接入新厂商（聊天）   | 看 [AI 与模型集成](./ai-models) 第"加新聊天模型"节                            |
| 接入新厂商（图片）   | 不走 ai-sdk，自己写 HTTP client——图片厂商格式不统一                           |

## 下一步读

- [本地开发](./development) —— 怎么改 + 加东西
- [AI 与模型集成](./ai-models) —— 模型定义 / provider 抽象
