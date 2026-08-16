# 领域模型

Kytos 的领域不是一组孤立页面，而是围绕“角色作为视觉参考，视觉资产进入插画和故事”的链路组织。

```text
角色创建草稿 -> 角色库 -> 锚点 / 动作 / 表情
                     \-> 插画参考
                     \-> 故事参与角色 -> 分镜版本 -> 图片资产
```

## 领域归属

| 领域     | 前端入口                | 主进程服务                               | 主要数据                         |
| -------- | ----------------------- | ---------------------------------------- | -------------------------------- |
| 角色创建 | `/character-create`     | `electron/services/character-create`     | 草稿、生成记录、生成图片         |
| 角色库   | `/character`            | `electron/services/character-library`    | 角色、草稿、当前库状态           |
| 角色锚点 | `/character-anchor`     | `electron/services/character-visual`     | 参考板、官方视觉、视觉图片       |
| 动作     | `/character-action`     | `electron/services/character-visual`     | 动作视觉记录和图片               |
| 表情     | `/character-expression` | `electron/services/character-expression` | 表情记录、图片、任务             |
| 插画     | `/illustration`         | `electron/services/illustration`         | 主题、版本、参考角色、上传素材   |
| 故事     | `/stories`、`/story`    | `electron/services/story`                | 故事、分镜、版本、图片、参与角色 |

跨领域数据通过 `shared/character*.ts`、`shared/illustration.ts`、`shared/story.ts` 等类型传递。服务之间可以复用明确的资产和角色引用，但不要直接读取另一个领域的表来绕过它的服务接口。

## 持久化原则

- 应用级设置和凭据在应用数据库中。
- 工作区内容在当前工作区数据库中，切换工作区时由 `electron/storage/database.ts` 关闭旧连接并切换新连接。
- 每个领域拥有自己的 schema 和 migration，迁移由 store 首次使用时懒加载执行。
- 数据库记录保存相对资产路径、版本和状态；图片文件由工作区文件服务管理。

修改领域模型时，需要同步检查类型、IPC、schema/migration、资产清理和前端空状态，而不是只改一个页面字段。
