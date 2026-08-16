---
title: AI Elements 完整教程
description: 从消息列表和 Prompt 输入开始，学会 Vue AI Elements、流式状态、工具调用、Reasoning 和附件界面。
---

# AI Elements 完整教程

AI Elements 是用于构建 AI 交互界面的可组合组件层。它不负责调用模型；它把 AI SDK 提供的 messages、parts 和 status 渲染成可用的对话、提示输入、附件、推理过程和工具状态。

本教程使用 shadcn-vue 风格的 Vue AI Elements 源码组件。它与 Vercel 的 React AI Elements 理念相近，但组件实现和导入方式不同。

## 1. 数据层和 UI 层

```text
AI SDK
messages + status + sendMessage + stop
                 │
                 ▼
AI Elements
Conversation / Message / PromptInput / Tool / Reasoning
                 │
                 ▼
Feature component
业务文案、工具含义、附件规则、页面流程
```

- AI SDK 管消息协议和请求。
- AI Elements 管通用 AI 交互行为和视觉结构。
- feature component 决定当前业务要显示什么、允许什么、工具结果意味着什么。

## 2. 组件家族

| 组件                         | 作用                           |
| ---------------------------- | ------------------------------ |
| `Conversation`               | 消息滚动容器                   |
| `ConversationContent`        | 消息内容布局                   |
| `ConversationEmptyState`     | 空对话状态                     |
| `ConversationScrollButton`   | 回到最新消息                   |
| `Message` / `MessageContent` | 一条 user/assistant 消息的外层 |
| `MessageResponse`            | 流式 Markdown 文本             |
| `PromptInput`                | 输入组合容器                   |
| `PromptInputTextarea`        | 文本输入                       |
| `PromptInputSubmit`          | 提交/停止状态按钮              |
| `Reasoning`                  | 可折叠的推理内容               |
| `Tool`                       | 工具调用输入、进度、结果和错误 |
| `Attachments` / `Attachment` | 附件预览和移除                 |
| `Loader`                     | 等待首个流数据                 |

这些是原语，不是一个不能改的完整聊天页。通过 props、slot 和 class 组合业务界面。

## 3. 最小对话列表

```vue
<script setup lang="ts">
import type { UIMessage } from 'ai';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';

defineProps<{ messages: UIMessage[] }>();
</script>

<template>
  <Conversation class="min-h-0 flex-1">
    <ConversationContent class="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
      <ConversationEmptyState
        v-if="messages.length === 0"
        title="开始对话"
        description="输入一个问题。"
      />

      <Message v-for="message in messages" :key="message.id" :from="message.role">
        <MessageContent>
          <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
            <MessageResponse v-if="part.type === 'text'" :content="part.text" />
          </template>
        </MessageContent>
      </Message>
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
</template>
```

`MessageResponse` 比直接插值多处理了 Markdown、代码块和流式中间状态。消息 key 使用稳定 `message.id`，part 没有 ID 时可在当条消息内使用 index。

## 4. 不要把 message 当字符串

`UIMessage.parts` 可以包含：

```text
text
reasoning
file
source-url / source-document
tool-<toolName>
data-<customType>
```

正确方式是按 `part.type` 分派：

```vue
<template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
  <MessageResponse v-if="part.type === 'text'" :content="part.text" />
  <Reasoning v-else-if="part.type === 'reasoning'">...</Reasoning>
  <Attachment v-else-if="part.type === 'file'" :data="part" />
  <Tool v-else-if="part.type === 'tool-searchNotes'">...</Tool>
</template>
```

这样新增工具、图片或 source 时，不需要破坏文本消息实现。

## 5. Prompt 输入

```vue
<script setup lang="ts">
import type { ChatStatus, FileUIPart } from 'ai';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';

const props = defineProps<{ disabled: boolean; status: ChatStatus }>();
const emit = defineEmits<{
  send: [payload: { text: string; files: FileUIPart[] }];
  stop: [];
}>();

function handleSubmit(message: PromptInputMessage) {
  const text = message.text.trim();
  if ((!text && message.files.length === 0) || props.disabled || props.status !== 'ready') return;
  emit('send', { text, files: message.files });
}

function handleSubmitClick(event: MouseEvent) {
  if (props.status === 'submitted' || props.status === 'streaming') {
    event.preventDefault();
    emit('stop');
  }
}
</script>

<template>
  <PromptInputProvider @submit="handleSubmit">
    <PromptInput class="mx-auto w-full max-w-3xl">
      <PromptInputBody>
        <PromptInputTextarea placeholder="输入消息…" :disabled="disabled" />
      </PromptInputBody>
      <PromptInputFooter class="justify-end">
        <PromptInputSubmit :status="status" :disabled="disabled" @click="handleSubmitClick" />
      </PromptInputFooter>
    </PromptInput>
  </PromptInputProvider>
</template>
```

`PromptInputProvider` 管理输入上下文和附件，`PromptInput` 管结构，`PromptInputSubmit` 根据 status 表达发送或停止。业务组件仍负责当前是否允许发送。

## 6. 交互状态机

```text
ready
  │ submit
  ▼
submitted ── first chunk ──▶ streaming
  │                              │
  ├─ error ──▶ error             ├─ finish ──▶ ready
  └─ stop  ──▶ ready             └─ stop   ──▶ ready
```

| 状态        | 输入框           | 提交按钮  | 消息区               |
| ----------- | ---------------- | --------- | -------------------- |
| `ready`     | 可输入           | 发送      | 正常显示             |
| `submitted` | 根据产品选择锁定 | 停止      | 显示 Loader          |
| `streaming` | 根据产品选择锁定 | 停止      | 增量渲染最后一条消息 |
| `error`     | 允许修改         | 重试/发送 | 保留上下文并显示错误 |

不要另外维护 `isLoading`、`isThinking`、`isStreaming` 三个可能互相矛盾的布尔值。使用 `ChatStatus` 作为主状态，业务特有的上传、转码等任务单独建模。

## 7. 连接 `useChat`

```vue
<script setup lang="ts">
import type { FileUIPart } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/vue';
import ChatInput from './ChatInput.vue';
import ChatMessages from './ChatMessages.vue';

const { messages, sendMessage, status, error, stop, regenerate } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});

async function send(payload: { text: string; files: FileUIPart[] }) {
  await sendMessage({ text: payload.text, files: payload.files });
}
</script>

<template>
  <main class="flex h-full min-h-0 flex-col overflow-hidden">
    <ChatMessages :messages="messages" :status="status" />
    <p v-if="error" role="alert" class="text-destructive px-4 text-sm">
      {{ error.message }}
      <Button variant="outline" @click="regenerate()">重试</Button>
    </p>
    <ChatInput :status="status" :disabled="false" @send="send" @stop="stop" />
  </main>
</template>
```

页面负责编排 `useChat`，消息和输入分别下沉到 feature component。页面不会变成一个超大聊天组件。

## 8. Reasoning

```vue
<Reasoning
  v-if="part.type === 'reasoning'"
  :is-streaming="status === 'streaming' && message.id === messages.at(-1)?.id"
>
  <ReasoningTrigger />
  <ReasoningContent :content="part.text" />
</Reasoning>
```

Reasoning 是可选能力，只在 provider 真正返回对应 part 时渲染。不要把应用自己编造的“正在思考…”冒充模型推理内容，也不要默认展开大段中间过程挤压主回答。

## 9. 工具 UI

工具 part 本身是一个状态机：

```text
input-streaming
      ↓
input-available
      ↓
output-available / output-error
```

某些工具还会经过 approval-requested 和 approval-responded。通用工具容器可以这样组合：

```vue
<Tool v-if="part.type === 'tool-searchNotes'">
  <ToolHeader :type="part.type" :state="part.state" title="搜索笔记" />
  <ToolContent>
    <ToolInput v-if="'input' in part" :input="part.input" />
    <ToolOutput
      v-if="part.state === 'output-available'"
      :output="part.output"
      :error-text="undefined"
    />
    <ToolOutput
      v-else-if="part.state === 'output-error'"
      :output="undefined"
      :error-text="part.errorText"
    />
  </ToolContent>
</Tool>
```

对重要工具，不要只打印 JSON。把结果翻译成用户关心的状态，例如“已更新 3 条笔记”，并保留可展开的详情。

### 需要确认的工具

删除、付费、发布和对外发送不能因为模型调用 tool 就自动执行。UI 应说明即将发生什么、目标是什么、是否可撤销，然后用 approval API 返回人的决定。

## 10. 附件

```vue
<PromptInputProvider
  accept="image/*"
  :max-file-size="10 * 1024 * 1024"
  :max-files="4"
  @submit="handleSubmit"
>
  <PromptInput multiple accept="image/*" :max-files="4">
    <PromptInputBody>
      <Attachments>
        <Attachment v-for="file in files" :key="file.url" :data="file" />
      </Attachments>
      <PromptInputTextarea />
    </PromptInputBody>
  </PromptInput>
</PromptInputProvider>
```

附件约束要同时在三处存在：

1. UI 的 accept、数量、大小和移除反馈。
2. 请求边界的运行时验证。
3. provider 能力检查，不支持图片的模型不允许附加图片。

文件名、MIME 和扩展名都不能单独证明文件安全。服务端/主进程仍要限制大小、解析内容并控制存储位置。

## 11. 滚动行为

- 用户仍在底部时，新 chunk 跟随到最新内容。
- 用户向上阅读历史后，新 chunk 不强制把视口拉回底部。
- 显示 `ConversationScrollButton` 让用户自己回到最新消息。
- 输入区保持稳定，只让 Conversation 内部滚动。

不要在每个 chunk 后无条件调用 `scrollToBottom()`，这会让用户无法阅读历史。

## 12. 空、加载、错误和中断

- **空状态**：可以提供少量可直接提交的 suggestions，不用大段功能介绍填满工作区。
- **等待首 chunk**：`submitted` 时用 Loader，不提前创建内容为省略号的假 assistant 消息。
- **错误**：错误与它影响的区域靠近，保留用户输入并提供重试，不用短暂 toast 代替持续错误。
- **用户中断**：区分用户停止和请求失败，并明确部分回答是否保留。

## 13. 性能与长对话

- 不要在每个 chunk 重新计算全部消息的重型派生数据。
- 代码高亮、Markdown 和大列表可以按 message/part 分层渲染。
- 长对话可考虑虚拟列表，但要先保证流式消息的动态高度和滚动锚点正确。
- 图片预览设置稳定尺寸或 aspect ratio，避免加载后页面跳动。
- 把已结束的旧消息与正在 streaming 的最后一条区分处理。

## 14. 可访问性

1. 输入有 label 或明确的可访问名称。
2. 发送和停止按钮的名称随状态改变。
3. 工具进度不只用颜色表达，同时有文本。
4. 错误区使用 `role="alert"` 或合适 live region，避免每个 token 都被读屏器宣告。
5. 附件移除、消息复制和重试等纯图标操作有 `aria-label` 和 Tooltip。
6. Dialog、menu 和 popover 使用现成可访问原语，不自制焦点管理。

## 15. 常见错误

| 错误                                 | 改法                                    |
| ------------------------------------ | --------------------------------------- |
| 自己写一套消息气泡和输入框           | 组合 Conversation、Message、PromptInput |
| 把 message 当成一个 `content` 字符串 | 按 `parts` 的 `type` 分派               |
| 多个 loading 布尔值互相矛盾          | 用 `ChatStatus` 建主状态机              |
| streaming 时强制滚到底部             | 只在用户仍靠近底部时跟随                |
| 工具只显示原始 JSON                  | 渲染业务含义，详情按需展开              |
| 不支持图片的模型仍显示附件按钮       | 根据 model capability 禁用并说明        |
| 错误只发 toast                       | 在对话或输入区保留错误与重试            |
| 付费/删除 tool 自动执行              | 显示影响并等待人为 approval             |

## 16. 练习

为笔记整理 Agent 实现完整对话界面：

1. 空状态提供 3 个可直接提交的建议。
2. 按 parts 渲染 text、reasoning、file 和两种 tool。
3. `submitted` 显示 Loader，`streaming` 时提交按钮变为停止。
4. 用户向上阅读时不被新 chunk 拉回底部。
5. 附件限制 4 张图、每张 10 MB，前端和请求边界都验证。
6. 更新 tool 显示业务结果，删除 tool 必须等待人工确认。
7. 错误后保留输入和历史，可以修改后再发或原样重试。

至此，纯技术教程已经从 TypeScript 走到 AI 交互界面。接下来可以进入 [Kytos 开发文档](/developer/)，学习这些技术在具体项目中的组织方式。
