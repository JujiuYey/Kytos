# 数据库与迁移

Kytos 的迁移由 `electron/storage/migrations.ts` 统一运行。迁移记录保存在 `schema_migrations`，每个 migration 使用独立事务；同一个 migration name 只会成功执行一次。

## 当前迁移分布

| 领域       | 迁移                                                              |
| ---------- | ----------------------------------------------------------------- |
| 应用数据库 | `001_application_settings_and_credentials`                        |
| 角色库     | `002_character_library_tables`                                    |
| 角色创建   | `003_character_create_tables`                                     |
| 角色视觉   | `004` 至 `009` 的视觉表和锚点契约演进                             |
| 插画       | `005_illustration_tables`、`008_illustration_reference_materials` |
| 故事       | `006`、`010`、`011` 的故事、分镜和版本表                          |
| 表情       | 初始表以及 `007` 的后续演进                                       |

具体编号和 SQL 以各领域 `schema.ts` 为准；编号跨领域不代表执行顺序，migration name 必须全局唯一。

## 初始化时机

工作区数据库切换后，领域 store 在首次使用时通过 WeakSet 等机制确保 schema 初始化只做一次。应用数据库在应用启动和凭据/设置服务使用时初始化。新领域不能假设另一个领域的 store 已经先运行。

## 添加迁移

1. 在拥有这张表的领域 `schema.ts` 增加唯一 migration name。
2. 迁移只做结构和可验证的数据转换，使用现有 `runInTransaction`。
3. 对旧版本数据写出明确的兼容分支或默认值，不把破坏性清理藏在读取逻辑里。
4. 更新对应 types、repository/service 和删除路径。
5. 用旧数据库副本验证升级、重复启动和工作区切换。
6. 运行 `pnpm build:web`、类型检查和 `git diff --check`。

## 约束

- 不要修改已经执行过的 migration；追加新 migration。
- 不要在渲染进程或 IPC handler 中临时建表。
- 迁移失败应让事务回滚，并保留可诊断的错误。
- 删除列、重命名表和资产迁移要同时考虑旧版本用户的数据恢复路径。
