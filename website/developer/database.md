---
title: 数据库与迁移
description: 应用级和工作区级 SQLite、Migration 工具链、扩展数据模型。
---

# 数据库与迁移

Kytos 用两个 SQLite 分开存"应用配置 / 凭据"和"作品数据"。理解这条边界是改任何持久化代码的前提。

## 为什么是两个库

| 数据库   | 文件                | 位置                  | 保存什么                                         |
| -------- | ------------------- | --------------------- | ------------------------------------------------ |
| 应用级   | `kytos-app.sqlite3` | Electron 用户数据目录 | 当前工作区路径、主题、默认模型、加密后的 API Key |
| 工作区级 | `kytos.sqlite3`     | 用户选择的作品目录    | 角色、表情、视觉资产、插画主题和版本、故事、分镜 |

把凭据和工作区分开有两个直接效果：

1. **切换工作区不丢凭据**：跟同事共享工作区时你的 API Key 不会跟过去
2. **作品目录可以独立版本控制**：`kytos.sqlite3` 在用户选择的目录里

## 共享工具：`electron/storage/migrations.ts`

两张数据库都依赖同一个 migration runner：

```ts
// electron/storage/migrations.ts:10-32 节选
export function runDatabaseMigrations(
  database: DatabaseSync,
  migrations: readonly DatabaseMigration[],
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  const hasMigration = database.prepare('SELECT 1 FROM schema_migrations WHERE name = ?');
  const recordMigration = database.prepare(
    'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
  );

  for (const migration of migrations) {
    if (hasMigration.get(migration.name)) continue;
    runInTransaction(database, () => {
      migration.migrate(database);
      recordMigration.run(migration.name, new Date().toISOString());
    });
  }
}
```

要点：

- **每条 migration 都在独立事务里执行**——失败回滚不会把 schema_migrations 表污染
- **`name` 是字符串主键**——按编号 + 名字命名：`001_xxx`、`002_xxx`
- **不可逆**：当前没有 `down`。表错了要写新 migration 修，不要回滚历史

事务包装器是同一个文件里的 `runInTransaction`：

```ts
// electron/storage/migrations.ts:35-44 节选
export function runInTransaction<T>(database: DatabaseSync, operation: () => T): T {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error: unknown) {
    database.exec('ROLLBACK');
    throw error;
  }
}
```

任何"多写一行的更新"必须包进这个，否则一半成功一半失败会留下脏数据。

## 应用级数据库

`electron/storage/app-database.ts` 是入口，三件事：

- 模块级单例——`getApplicationDatabase()` 只创建一个连接
- 第一次启动时跑 `APPLICATION_MIGRATIONS`
- 文件不存在时新建并 `chmod 0o600`（防止其他用户读到凭据）

```ts
// electron/storage/app-database.ts:46-60 节选
export function getApplicationDatabase(): DatabaseSync {
  if (applicationDatabase) return applicationDatabase;
  const filePath = path.join(app.getPath('userData'), DATABASE_FILE_NAME);
  const databaseExisted = existsSync(filePath);
  const database = new DatabaseSync(filePath, {
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });
  if (!databaseExisted) chmodSync(filePath, 0o600);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  runDatabaseMigrations(database, APPLICATION_MIGRATIONS);
  applicationDatabase = database;
  return database;
}
```

当前 schema 只两张表：

```text
application_settings  id 永远 = 1；主题、默认模型、工作区路径
credentials           service ∈ {apimart, deepseek, minimax} + 加密值
```

### 加一张应用级表

追加到 `APPLICATION_MIGRATIONS`：

```ts
// electron/storage/app-database.ts 在数组末尾追加：
{
  name: '002_my_new_table',
  migrate(database) {
    database.exec(`
      CREATE TABLE my_table (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      ) STRICT;
    `);
  },
},
```

然后写配套 service 函数（如 `electron/services/workspace/settings.ts` 的 `saveAppSettings` 风格）。

## 工作区级数据库

`electron/storage/database.ts` 是入口。这里**没有模块级单例**——切换工作区时关闭旧连接：

```ts
// electron/storage/database.ts:16-38 节选
let activeWorkspaceDatabase: WorkspaceDatabase | null = null;

export async function getWorkspaceDatabase(): Promise<DatabaseSync> {
  const workspacePath = await getWorkspaceDirectory();
  const filePath = path.join(workspacePath, DATABASE_FILE_NAME);
  if (activeWorkspaceDatabase?.filePath === filePath) {
    return activeWorkspaceDatabase.database;
  }

  activeWorkspaceDatabase?.database.close();
  const databaseExisted = existsSync(filePath);
  const database = new DatabaseSync(filePath, {
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });
  if (!databaseExisted) chmodSync(filePath, 0o600);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  activeWorkspaceDatabase = { database, filePath };
  return database;
}
```

工作区数据库的迁移**在每个领域 store 里跑**，不是集中入口。看 `electron/services/story/store.ts:50-57`：

```ts
async function getStoryDatabase(): Promise<DatabaseSync> {
  const database = await getWorkspaceDatabase();
  if (!initializedDatabases.has(database)) {
    runDatabaseMigrations(database, STORY_MIGRATIONS);
    initializedDatabases.add(database);
  }
  return database;
}
```

`WeakSet` 保证同一连接只跑一次——切回旧工作区不会重跑。

::: tip 多个领域共享同一张工作区库
所有 `STORY_MIGRATIONS` / `CHARACTER_LIBRARY_MIGRATIONS` 等落到**同一份 `kytos.sqlite3`**。migration 之间不能重名——加新表时全局搜一下 schema 文件避开冲突。
:::

### 加一张工作区级表

以"插画收藏夹"为例。先找到对应 schema 文件（每个领域独立一个 `schema.ts`）：

```ts
// electron/services/illustration/schema.ts 中追加
{
  name: '003_illustration_favorites',
  migrate(database) {
    database.exec(`
      CREATE TABLE illustration_favorites (
        illustration_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        FOREIGN KEY (illustration_id) REFERENCES illustrations (id) ON DELETE CASCADE
      ) STRICT;
    `);
  },
},
```

并在对应 `store.ts` 的 `getStoryDatabase` 风格 wrapper 里把 `ILLUSTRATION_MIGRATIONS` 传进 `runDatabaseMigrations`。

::: warning 跨领域的迁移串行问题
两个领域 store 在同一份 SQLite 上跑迁移——如果两个都加 `'001_xxx'` 名字会冲突。任何 migration 的 `name` 必须**全局唯一**。
:::

## 常用操作清单

| 操作        | 用法                                             | 备注                   |
| ----------- | ------------------------------------------------ | ---------------------- |
| 读一行      | `database.prepare('SELECT ...').get(...)`        | 返回单条或 `undefined` |
| 读多行      | `database.prepare('SELECT ...').all(...)`        | 返回数组               |
| 写一行      | `database.prepare('INSERT/UPDATE ...').run(...)` | 参数化绑定             |
| 多写事务    | `runInTransaction(db, () => { ... })`            | 任何 2+ 写都要包       |
| 防 SQL 注入 | 永远用 prepare 占位符                            | 不要拼字符串           |

::: tip STRICT 模式
所有 `CREATE TABLE` 都标了 `STRICT`——SQLite 会拒绝类型不严格匹配的插入。这是设计上故意的：宁可启动报错也不要脏数据写进去。
:::

::: warning 不要在 renderer 直接访问 SQLite
所有 SQLite 操作都在主进程——`window.desktop.foo(...)` 是唯一入口。多进程访问同一文件会立刻坏。
:::

## 下一步读

- [AI 与模型集成](./ai-models) —— provider 抽象
- [构建与发布](./release) —— 0.2.0 怎么发布
