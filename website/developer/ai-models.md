---
title: AI 与模型集成
description: 聊天模型和图片模型的 provider 抽象、扩展一个新模型。
---

# AI 与模型集成

Kytos 用 Vercel AI SDK（`ai` + `@ai-sdk/openai-compatible`）做对话，用厂商 OpenAI-兼容的 HTTP 接口做图片生成。本页讲清抽象在哪儿、加一个新模型走哪些文件。

## 两个模型类

| 模型类              | 用途                                | 定义文件                | 当前厂商                              |
| ------------------- | ----------------------------------- | ----------------------- | ------------------------------------- |
| 聊天 (`ChatModel`)  | 文本生成、对话、prompt 整理、多模态 | `shared/chat-model.ts`  | DeepSeek (V4 Flash / Pro)、MiniMax M3 |
| 图片 (`ImageModel`) | 角色动作、表情、插画、分镜          | `shared/image-model.ts` | APIMart (`gpt-image-2`)               |

两者**完全独立**：同一张图任务可以走 APIMart，对话上下文走 DeepSeek + MiniMax，互不干扰。

## 聊天模型定义

`shared/chat-model.ts` 完整结构只有 60 行：

```ts
// shared/chat-model.ts:1-15 节选
export const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];

export const MINIMAX_MODELS = ['MiniMax-M3'] as const;
export type MiniMaxModel = (typeof MINIMAX_MODELS)[number];

export const CHAT_MODELS = [...DEEPSEEK_MODELS, ...MINIMAX_MODELS] as const;
export type ChatModel = (typeof CHAT_MODELS)[number];
export type ChatModelProvider = 'deepseek' | 'minimax';
```

每模型附带 `ChatModelDefinition`，记录 label、provider、能力：

```ts
// shared/chat-model.ts:23-42 节选
export const CHAT_MODEL_DEFINITIONS: Record<ChatModel, ChatModelDefinition> = {
  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    provider: 'deepseek',
    supportsImageInput: false,
  },
  'MiniMax-M3': {
    id: 'MiniMax-M3',
    label: 'MiniMax M3',
    provider: 'minimax',
    supportsImageInput: true, // 唯一支持多模态
  },
};
```

`supportsImageInput` 是 UI 层的关键开关——UI 据此决定是否允许拖入参考图。

## 图片模型定义

`shared/image-model.ts` 9 行整：

```ts
// shared/image-model.ts:1-9 全文
export const IMAGE_MODELS = ['gpt-image-2'] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];
export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-2';
export function isImageModel(value: unknown): value is ImageModel {
  return typeof value === 'string' && IMAGE_MODELS.includes(value as ImageModel);
}
```

::: warning 加新图片模型比加新聊天模型复杂
聊天模型加完定义就够了，路由层有分支。**图片模型**的任务调用堆栈在 `electron/services/*/image-task.ts` 等处，新厂商往往意味着新的请求 / 响应结构——比聊天麻烦。
:::

## Provider 层

`electron/providers/` 把 `ChatModel` 路由到厂商实现：

```ts
// electron/providers/chat-provider.ts:10-22 节选
export function getChatModelProvider(model: ChatModel): ChatModelProvider {
  return getChatModelDefinition(model).provider;
}

export function createChatLanguageModel(apiKey: string, model: ChatModel) {
  if (getChatModelProvider(model) === 'minimax') {
    return createMinimaxCompatibleProvider(apiKey)(model);
  }
  return createDeepSeekCompatibleProvider(apiKey)(model);
}
```

每个厂商一层薄封装，复用 `@ai-sdk/openai-compatible`：

```ts
// electron/providers/deepseek-provider.ts:1-11 全文
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com';

export function createDeepSeekCompatibleProvider(apiKey: string) {
  return createOpenAICompatible({
    apiKey,
    baseURL: DEEPSEEK_API_BASE_URL,
    name: 'deepseek',
  });
}
```

`minimax-provider.ts` 同形（只换 baseURL）。

## 加一个新聊天模型

**示例**：加一个"Kimi V2"，5 步。

**Step 1** —— `shared/chat-model.ts` 加常量、扩展联合：

```ts
export const KIMI_MODELS = ['kimi-v2'] as const;
export type KimiModel = (typeof KIMI_MODELS)[number];

export const CHAT_MODEL_PROVIDERS = ['deepseek', 'minimax', 'kimi'] as const;
export type ChatModelProvider = (typeof CHAT_MODEL_PROVIDERS)[number];

export const CHAT_MODELS = [...DEEPSEEK_MODELS, ...MINIMAX_MODELS, ...KIMI_MODELS] as const;
export type ChatModel = (typeof CHAT_MODELS)[number];
```

并在 `CHAT_MODEL_DEFINITIONS` 里补 `'kimi-v2'` 的 entry。

**Step 2** —— 新建 `electron/providers/kimi-provider.ts`：

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const KIMI_API_BASE_URL = 'https://api.moonshot.cn/v1';

export function createKimiCompatibleProvider(apiKey: string) {
  return createOpenAICompatible({
    apiKey,
    baseURL: KIMI_API_BASE_URL,
    name: 'kimi',
  });
}
```

**Step 3** —— `electron/providers/chat-provider.ts` 加分支：

```ts
const PROVIDER_FACTORIES: Record<ChatModelProvider, (apiKey: string) => ChatFactory> = {
  minimax: createMinimaxCompatibleProvider,
  deepseek: createDeepSeekCompatibleProvider,
  kimi: createKimiCompatibleProvider,
};

export function createChatLanguageModel(apiKey: string, model: ChatModel) {
  return PROVIDER_FACTORIES[getChatModelProvider(model)](apiKey)(model);
}
```

**Step 4** —— `electron/ipc/credentials.ts:11` 加白名单：

```ts
const credentialServices: CredentialService[] = ['apimart', 'deepseek', 'minimax', 'kimi'];
```

并确保 `shared/settings.ts` 里的 `CredentialService` 联合也加 `'kimi'`。

**Step 5** —— UI：渲染端默认模型 / 设置选择器从 `CHAT_MODELS` 自动出现，**不用手动改前端**。

::: warning narrow 函数别忘
`shared/chat-model.ts` 加模型后，`isChatModel` 等顶层 narrow 函数自动包含——但 IPC 边界自己写的 `isKimiModel(value: unknown)` 要补。
:::

## Agent 层：受约束的对话编排

`electron/agents/` 不是接外部 API 的层，是**受约束的对话编排**：

- `character-create-agent/` —— 帮用户整理角色设定
- `illustration-agent/` —— 帮用户整理插画 brief 和 prompt
- `story-agent/` —— 帮用户整理故事和分镜

每个 agent 拿一个 chat model + 用户上下文，输出**结构化 JSON**（schema 由 shared/ 里的 interface 定义）。它们用 `createChatLanguageModel` 拿到语言模型。

::: tip schema 是单一来源
shared/ 里 `character-create.ts` / `illustration.ts` / `story.ts` 的 interface 同时给：

- IPC 输入校验（`electron/ipc/` 用 zod parse）
- Agent 输出解析（zod safeParse）
- 前端 TypeScript 类型
  :::

## Provider 选项（高级）

某些模型需要特定参数。看 `electron/providers/deepseek-provider.ts:13-17`：

```ts
export const DEEPSEEK_PROVIDER_OPTIONS = {
  deepseek: {
    thinking: { type: 'disabled' },
  },
} as const;
```

关闭深度推理。`getChatProviderOptions(model)` 把它透传给 chat 调用。如果新厂商也有"特色参数"，照这个 pattern 暴露。

## 下一步读

- [数据库与迁移](./database) —— 模型设置和应用配置存在哪
- [构建与发布](./release) —— 0.2.0 怎么发布
