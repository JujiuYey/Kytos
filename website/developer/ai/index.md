# AI 集成

Kytos 把 AI 分成两类能力：聊天模型负责理解需求、补全结构化草稿和生成提示词；图片模型负责提交异步生图任务并把结果落到工作区。

## 当前模型清单

| 能力 | 当前模型                                             | 入口                    |
| ---- | ---------------------------------------------------- | ----------------------- |
| 聊天 | `deepseek-v4-flash`、`deepseek-v4-pro`、`MiniMax-M3` | `shared/chat-model.ts`  |
| 图片 | `gpt-image-2`                                        | `shared/image-model.ts` |

默认聊天模型是 `MiniMax-M3`，默认图片模型是 `gpt-image-2`。模型定义还声明是否支持图片输入，页面和服务应使用这个能力字段，不要根据模型名称猜测。

## 请求分流

- 角色创建、插画和故事对话使用 AI SDK `ToolLoopAgent`。
- 表情提示词和部分视觉提示词使用 `generateText`。
- 图片生成统一经过 `electron/utils` 的 request body、submit、poll 和 download 辅助函数。
- 所有 API key 都从主进程凭据服务读取，渲染进程只收到状态，不接触密钥。

继续阅读：[Agents](/developer/ai/agents)、[图片生成](/developer/ai/image-generation)、[Provider](/developer/ai/providers)。
