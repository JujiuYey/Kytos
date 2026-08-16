# 角色工作流

角色相关功能分成“创建草稿”和“角色资产库”两段。创建阶段不直接把一次生成结果当成正式角色；用户确认后，角色才进入库，并可以继续生成锚点、动作和表情。

## 创建角色

入口是 `/character-create`，主进程代码位于 `electron/services/character-create/`，对话 agent 位于 `electron/agents/character-create-agent/`。

1. 页面收集角色草稿和可选参考图。
2. 对话请求进入 `character-create` IPC handler，agent 最多运行 5 步。
3. `updateCharacterDraft` 只更新已提供的人物字段。
4. `finalizeCharacterPrompt` 根据草稿和画风组装最终提示词，但不会保存正式角色档案。
5. 生图任务写入生成记录，图片文件保存到工作区资产目录。
6. 用户确认后，角色库服务创建正式角色并建立引用关系。

## 角色资产

角色库入口是 `/character`。选中的角色可以进入：

- `/character-anchor`：生成和管理角色锚点、参考板以及官方视觉。
- `/character-action`：生成动作视觉，复用角色的锚点和参考资产。
- `/character-expression`：生成表情资产，任务和图片由 `character-expression` 服务管理。

这些页面共享角色 id 和资产引用，不共享数据库连接。需要增加一种角色资产时，先扩展对应 service 的 types/schema，再扩展 IPC 和页面。

## 代码定位

| 问题               | 先看                                                        |
| ------------------ | ----------------------------------------------------------- |
| 草稿字段和提示词   | `electron/services/character-create/types.ts`、`request.ts` |
| 角色库 CRUD        | `electron/services/character-library/crud.ts`               |
| 锚点、动作和官方图 | `electron/services/character-visual/`                       |
| 表情生成任务       | `electron/services/character-expression/generation.ts`      |
| 图片落盘和清理     | 各领域的 `assets.ts`                                        |

删除角色或版本时，同时确认数据库记录、引用记录和工作区图片是否都被清理；不要只从列表中移除一行。
