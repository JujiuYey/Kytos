# Agent 执行

三个领域 agent 都使用 AI SDK 的 `ToolLoopAgent` 和 Zod 输入 schema。agent 只负责对话决策和调用工具，真正的持久化仍由领域 service 完成。

| Agent    | 入口                                     | 最大步数 | 工具                                                                                            |
| -------- | ---------------------------------------- | -------: | ----------------------------------------------------------------------------------------------- |
| 角色创建 | `electron/agents/character-create-agent` |        5 | `updateCharacterDraft`、`finalizeCharacterPrompt`                                               |
| 插画     | `electron/agents/illustration-agent`     |        4 | `updateIllustrationBrief`、`presentIllustrationPlan`                                            |
| 故事     | `electron/agents/story-agent`            |        5 | `updateStoryDraft`、`presentStory`、`presentStoryboard`、`updateStoryShot`、`confirmStoryboard` |

## 一次 agent 请求

1. IPC handler 校验 sender 和请求参数。
2. service 读取当前领域状态、凭据和用户选择的引用。
3. agent 使用 `shared/` 类型构造 instruction 和工具 schema。
4. 工具执行 service 更新，返回结构化结果。
5. `createAgentUIStreamResponse` 将过程流回页面。
6. 页面根据工具结果刷新草稿、确认状态或任务状态。

`stopWhen: isStepCount(...)` 是资源边界，不代表业务已经完成。业务完成必须由 `ready`、`storyReady`、`storyboardStale` 等领域状态表达。

## 新增 agent 工具

先定义窄输入 schema，再让工具调用一个领域 service。工具不要直接写 SQL、读取文件绝对路径或返回不可结构化克隆的对象。需要用户确认的动作，应保存“待确认”状态，而不是让模型自行视为完成。
