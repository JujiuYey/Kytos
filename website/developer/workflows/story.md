# 故事工作流

故事功能分为列表 `/stories` 和编辑 `/story`。故事 agent 负责把用户输入整理成短篇故事和 3 至 6 个连续分镜；图片生成属于已确认分镜之后的独立操作。

## 故事与分镜

1. 页面创建或打开 story，并显式传入本次参与的角色集合。
2. `electron/agents/story-agent/` 读取故事草稿、参与角色和现有分镜状态，最多运行 5 步。
3. `updateStoryDraft` 保存用户补充的信息；`presentStory` 保存可确认的完整故事。
4. 用户确认故事后，`presentStoryboard` 生成 3 至 6 个分镜，并写入顺序、场景、动作、构图、连续性和最终提示词。
5. 用户修改单个分镜时，`updateStoryShot` 只 patch 指定 shot id。
6. 故事或参与角色改变后，分镜会进入待检查状态；用户确认后由 `confirmStoryboard` 解除该状态。
7. 用户确认分镜后，story generation service 为某个 shot 创建版本和图片任务，页面按 task id 更新进度。

## 版本和资产

`electron/services/story/` 负责故事、分镜、版本和图片的持久化。一个分镜可以有多个版本，新的生成结果不覆盖旧图片；资产文件由 `assets.ts` 管理，数据库保存版本状态和相对路径。

## Agent 工具

| 工具                | 用途                   |
| ------------------- | ---------------------- |
| `updateStoryDraft`  | 保存未完成的故事字段   |
| `presentStory`      | 保存并展示完整故事     |
| `presentStoryboard` | 创建分镜列表           |
| `updateStoryShot`   | 修改一个已有分镜       |
| `confirmStoryboard` | 确认故事与分镜仍然一致 |

调试故事问题时，先看 `storyReady` 和 `storyboardStale`，再看 shot/version 状态。参与角色是生成上下文的一部分，不能在 UI 中显示了角色却在 IPC 或 agent payload 中丢失。
