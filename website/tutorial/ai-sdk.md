---
title: AI SDK 完整教程
description: 从调用第一个语言模型开始，学会 provider、消息、流式生成、结构化输出、工具调用和 Agent。
---

# AI SDK 完整教程

AI SDK 是一套 TypeScript 工具，用统一接口调用不同语言模型，并处理流式输出、工具调用、消息协议和 Agent 循环。它不会替你设计 prompt、权限和业务边界，但会把与 provider 的通信细节标准化。

本教程以 AI SDK 7 的 API 为基准，示例 provider 使用 OpenAI-compatible 协议。

## 1. 核心概念

```text
Your application
      │ generateText / streamText / ToolLoopAgent
      ▼
AI SDK Core
      │ LanguageModel interface
      ▼
Provider adapter
      │ HTTP
      ▼
Model service
```

- **Model**：能接受消息并生成内容的具体模型。
- **Provider**：把某家服务的认证、URL 和请求协议适配成通用 `LanguageModel`。
- **Prompt/messages**：发给模型的输入。
- **Tool**：由应用定义、模型选择调用的结构化能力。
- **Stream**：在完整结果生成前就持续产出增量数据。

## 2. 安装与 provider

```bash
pnpm add ai @ai-sdk/openai-compatible zod
```

```ts
// model.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const provider = createOpenAICompatible({
  name: 'example-provider',
  apiKey: process.env.MODEL_API_KEY,
  baseURL: 'https://api.example.com/v1',
});

export const chatModel = provider('example-chat-model');
```

API Key 只留在服务端、CLI 进程或 Electron 主进程。不要把密钥放进浏览器 bundle、前端环境变量或发送给 renderer。

## 3. 第一次文本生成

```ts
import { generateText } from 'ai';
import { chatModel } from './model';

const result = await generateText({
  model: chatModel,
  system: '你是一名简洁的中文编辑。',
  prompt: '把这句话改写得更直接：我个人感觉可能这个方案会比较好。',
});

console.log(result.text);
console.log(result.usage);
```

`generateText` 等待整次生成完成，适合短任务、后台处理和必须拿到完整结果才继续的流程。

### system 与 user 输入分工

- `system`/instructions 定义长期角色、不变约束和输出边界。
- user message 表达这一次的任务和数据。
- 不要把用户文本拼进 system 指令，也不要让模型自己判断不该拥有的权限。

## 4. 多轮消息

```ts
import type { ModelMessage } from 'ai';

const messages: ModelMessage[] = [
  { role: 'user', content: '我想写一篇关于 SQLite 事务的文章。' },
  { role: 'assistant', content: '读者是什么程度？' },
  { role: 'user', content: '会 JavaScript，没学过数据库。' },
];

const result = await generateText({
  model: chatModel,
  system: '你负责设计教程大纲。',
  messages,
});
```

保留对话历史会增加 token 成本。长对话需要裁剪、总结、只保留必要业务状态，而不是永远发送全部历史。

## 5. 流式生成

```ts
import { streamText } from 'ai';

const result = streamText({
  model: chatModel,
  prompt: '用三段话解释事务的原子性。',
  abortSignal: controller.signal,
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

流式不是把完整字符串切成几段动画，而是模型尚未完成时就开始产出。因此消费端必须处理：

- 未完整 Markdown 和代码块。
- 用户主动停止导致的 abort。
- 中途断线和 provider 错误。
- 已显示的部分内容是保留还是丢弃。
- 结束原因和 usage 统计。

## 6. 结构化输出

不要要求模型“返回 JSON，不要 markdown”后就直接 `JSON.parse`。用 schema 定义应用真正接受的形状：

```ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

const outlineSchema = z.object({
  title: z.string().min(1).max(100),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        goal: z.string().min(1),
      }),
    )
    .min(1)
    .max(12),
});

const result = await generateText({
  model: chatModel,
  prompt: '为零基础读者设计 SQLite 事务教程大纲。',
  output: Output.object({ schema: outlineSchema }),
});

console.log(result.output.sections);
```

schema 给出机器可验证的约束。业务规则仍然要由程序检查，例如 ID 是否存在、用户是否有权、总价是否正确。

## 7. 工具调用

工具让模型选择一个结构化操作，应用决定是否和怎么执行：

```ts
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: chatModel,
  prompt: '把标题为“学习事务”的笔记标记为完成。',
  tools: {
    completeNote: tool({
      description: '将一条已存在的笔记标记为完成。',
      inputSchema: z.object({
        noteId: z.string().uuid(),
      }),
      execute: async ({ noteId }) => noteService.complete(noteId),
    }),
  },
});
```

工具安全原则：

1. 输入 schema 尽可能窄，限制长度、格式和枚举。
2. `execute` 里再验证资源、权限和当前状态。
3. 不把任意 SQL、shell 命令、URL 或文件路径交给模型自由构造。
4. 付费、删除、发布等高影响操作需要人为确认。
5. 工具返回最小必要数据，不把密密和全部记录送回模型。

## 8. Agent 循环

普通文本生成是一次模型调用。Agent 会在“模型决策 → 工具执行 → 工具结果回到模型”之间循环：

```ts
import { isStepCount, ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

export const noteAgent = new ToolLoopAgent({
  model: chatModel,
  instructions: '帮用户整理笔记。修改前先查询，不删除数据。',
  stopWhen: isStepCount(4),
  tools: {
    findNotes: tool({
      description: '按标题关键词查找笔记。',
      inputSchema: z.object({ query: z.string().min(1).max(100) }),
      execute: ({ query }) => noteService.search(query),
    }),
    updateNote: tool({
      description: '更新一条已存在笔记的标题。',
      inputSchema: z.object({
        noteId: z.string().uuid(),
        title: z.string().min(1).max(100),
      }),
      execute: ({ noteId, title }) => noteService.rename(noteId, title),
    }),
  },
});
```

`stopWhen` 是成本和可靠性边界。没有上限的循环可能重复调工具、消耗大量 token 或陷入无法完成的路径。

## 9. UI 消息与模型消息

AI SDK 区分两层消息：

- `UIMessage` 服务于交互界面，包含 text、reasoning、file、tool 状态等 parts。
- `ModelMessage` 是发给模型 provider 的输入。

不要把整个 UI 对象当作 provider 消息，也不要把模型原始响应直接当成稳定 UI 协议。AI SDK 的转换和流协议就是为了维护这个边界。

## 10. Vue 中使用 `useChat`

```bash
pnpm add @ai-sdk/vue
```

```ts
import { useChat } from '@ai-sdk/vue';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status, error, stop, regenerate } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
  }),
});

async function submit(text: string) {
  if (!text.trim() || status.value !== 'ready') return;
  await sendMessage({ text: text.trim() });
}
```

`status` 是有限状态：

| 状态        | 含义                   | 界面反应           |
| ----------- | ---------------------- | ------------------ |
| `ready`     | 可以发新消息           | 提交可用           |
| `submitted` | 已发送，等待首个 chunk | 显示等待反馈       |
| `streaming` | 正在接收流             | 增量显示，允许停止 |
| `error`     | 请求失败               | 显示错误和重试     |

消息的 `parts` 需要按 `type` 分派渲染，不能假设每条消息只有一个字符串。下一篇 [AI Elements](./ai-elements) 会完整实现界面层。

## 11. 错误、重试和取消

模型调用需要区分：

- 用户取消：通常不是错误，保留已生成内容或标记为已停止。
- 可重试错误：限流、短暂网络失败、provider 5xx，使用有上限的指数退避。
- 不可重试错误：无效密钥、不支持的模型、schema 不合法、请求过大。
- 工具错误：业务资源不存在或权限不足，不要通过重试绕过。

超时、abort signal、最大步数、最大输入长度和并发数都应该是显式约束。

## 12. 可观测性与成本

生产系统至少记录：

- 请求 ID、模型和 provider。
- 开始、首 token、完成和总耗时。
- input/output token 和估算成本。
- finish reason、tool 名称和步数。
- 错误类型和是否重试。

不要默认记录完整 prompt、对话、文件和工具结果，其中可能含隐私数据和密密。

## 13. 进阶设计原则

### 模型不是权限系统

模型说“可以删除”不等于用户有权删除。权限判断必须在工具/service 的确定性代码中。

### 模型不是数据库

业务状态存在数据库或 store，需要时作为上下文传入。不要依赖模型“记得”之前的真实状态。

### 把不确定性限制在狭边界

让模型做理解、归纳、分类、候选计划和文本生成；让程序做验证、授权、交易、计算和持久化。

## 14. 常见错误

| 错误                             | 改法                                  |
| -------------------------------- | ------------------------------------- |
| 前端直接带 API Key 调模型        | 调用放在服务端或主进程                |
| 用 prompt 要求 JSON 就直接 parse | schema 结构化输出 + 业务验证          |
| 模型可以调任意命令               | 提供窄、有 schema、有权限检查的 tools |
| Agent 不设步数上限               | 显式 `stopWhen` 和总成本限制          |
| 对话历史永不裁剪                 | 总结并只保留必要上下文                |
| 把任何失败都无限重试             | 分类错误，有界退避                    |
| 日志记录全部用户内容             | 默认记元数据，内容需明确脱敏策略      |

## 15. 练习

实现一个笔记整理 Agent：

1. `generateText` 产生一段简短摘要。
2. `Output.object` 输出标题、摘要和候选标签。
3. 定义 `findNotes` 和 `updateNote` 两个窄工具。
4. Agent 最多运行 4 步，不提供删除工具。
5. 通过 `useChat` 消费流，支持停止、错误和重试。
6. 记录模型、耗时、usage 和工具步数，不记录笔记全文。

下一步学习 [AI Elements](./ai-elements)，把流式消息、工具状态和附件组合成完整对话界面。
