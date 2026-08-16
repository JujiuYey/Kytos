# 数据边界

Kytos 有两类 SQLite 数据库，以及一套工作区文件目录。渲染进程不直接打开数据库，所有读写都由主进程 service 完成。

## 两类数据库

| 数据库       | 内容                         | 入口                               |
| ------------ | ---------------------------- | ---------------------------------- |
| 应用数据库   | 应用设置、模型凭据           | `electron/storage/app-database.ts` |
| 工作区数据库 | 角色、插画、故事及任务元数据 | `electron/storage/database.ts`     |

工作区切换时，`database.ts` 会关闭旧连接并切换活动连接。各领域 store 通过自己的 schema 初始化表和迁移；不要缓存跨工作区仍然有效的数据库对象。

## 领域表

| 领域     | 表的所有权                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| 角色库   | `characters`、`character_drafts`、`character_library_state`                                                        |
| 角色创建 | `character_create_generations`、`character_create_generation_images`                                               |
| 角色视觉 | `character_visual_records`、`character_visual_images`、`character_visual_references`、`character_official_visuals` |
| 角色表情 | records、images、references、tasks、task references、legacy imports                                                |
| 插画     | topics、versions、version images、character references、uploads                                                    |
| 故事     | stories、story shots、shot versions、version images、character references                                          |

完整字段以对应领域的 `schema.ts` 和 `types.ts` 为准。文档中的表名用于定位，不替代源码中的 schema。

## 文件型资产

图片和导出文件保存在工作区目录，数据库保存相对路径、所属领域、版本和状态。读取资产时经过 workspace file service 转换为应用协议 URL；页面不拼接本地绝对路径，也不自行删除文件。

新增持久化对象时，先决定它是元数据还是文件资产，再分别设计表约束、清理策略和 IPC 返回值。

## 相关入口

- 连接和活动工作区：`electron/storage/database.ts`
- 应用设置和凭据：`electron/storage/app-database.ts`
- 迁移运行器：`electron/storage/migrations.ts`
- 工作区文件：`electron/services/workspace/files.ts`
- 导出图片：`electron/services/workspace/image-export.ts`
