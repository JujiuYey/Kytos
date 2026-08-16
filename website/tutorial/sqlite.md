---
title: SQLite 完整教程
description: 从 SQL 和单文件数据库开始，学会建表、CRUD、事务、索引、WAL、migration 和 node:sqlite。
---

# SQLite 完整教程

SQLite 是嵌入应用进程的关系型数据库。它没有独立服务器、端口和连接池：应用通过 SQLite 库直接读写一个数据库文件。

它适合桌面应用、移动应用、本地工具、小型服务和测试数据。它不是玩具数据库，但并发写模型和运维方式与 PostgreSQL/MySQL 不同。

## 1. 基本心智模型

```text
Application process
       │ SQLite API
       ▼
notes.sqlite3
```

- 数据库是文件，但不能在写入中途当作普通文件复制。
- 多个读可以并发，但同一时刻只有一个 writer。
- SQL 定义表结构、约束、查询和事务。
- 应用要自己管理 schema 随版本演进。

## 2. 第一张表

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
```

这个 schema 同时表达数据形状和不变量：

- `PRIMARY KEY` 保证唯一标识。
- `NOT NULL` 拒绝缺失值。
- `DEFAULT` 为省略字段提供值。
- `CHECK` 约束 SQLite 中用 0/1 表示的布尔值。
- `STRICT` 让 SQLite 对列类型更严格。

SQLite 常用的存储类型是 `NULL`、`INTEGER`、`REAL`、`TEXT`、`BLOB`。日期通常存 ISO 8601 文本，布尔值存 0/1，并通过约束保证合法。

## 3. CRUD

### 新增

```sql
INSERT INTO notes (id, title, content, created_at, updated_at)
VALUES (?, ?, ?, ?, ?);
```

### 查询

```sql
SELECT id, title, content, archived, created_at, updated_at
FROM notes
WHERE archived = 0
ORDER BY updated_at DESC
LIMIT ? OFFSET ?;
```

### 更新与删除

```sql
UPDATE notes
SET title = ?, content = ?, updated_at = ?
WHERE id = ?;

DELETE FROM notes WHERE id = ?;
```

`?` 是绑定参数。值始终通过 driver 绑定，不要拼 SQL：

```ts
// 错误：可被引号破坏，也可能造成 SQL 注入
database.exec(`DELETE FROM notes WHERE id = '${id}'`);
```

## 4. 用 `node:sqlite` 访问数据库

Node.js 内置的 `node:sqlite` 提供同步 API：

```ts
import { DatabaseSync } from 'node:sqlite';

const database = new DatabaseSync('notes.sqlite3', {
  enableDoubleQuotedStringLiterals: false,
  enableForeignKeyConstraints: true,
  timeout: 5000,
});

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
`);
```

预编译语句可以复用：

```ts
const insertNote = database.prepare(`
  INSERT INTO notes (id, title, content, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`);

const now = new Date().toISOString();
insertNote.run(crypto.randomUUID(), '第一条笔记', '', now, now);
```

查单行使用 `get()`，查多行使用 `all()`，写入使用 `run()`。driver 返回的行是运行时数据，TypeScript 应用要把数据库行显式映射到领域类型。

## 5. 表设计与关系

一篇笔记可以有多个标签，一个标签也属于多篇笔记：

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE note_tags (
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) STRICT;
```

`note_tags` 是关联表。复合主键保证同一笔记不会重复关联同一标签。`ON DELETE CASCADE` 表示删除笔记或标签时自动删除关联行。

::: warning 外键需要启用
SQLite 的外键检查需要对连接启用。`node:sqlite` 可通过 `enableForeignKeyConstraints: true` 开启，其他 driver 可能需要 `PRAGMA foreign_keys = ON`。
:::

## 6. JOIN 与聚合

```sql
SELECT
  notes.id,
  notes.title,
  COUNT(note_tags.tag_id) AS tag_count
FROM notes
LEFT JOIN note_tags ON note_tags.note_id = notes.id
WHERE notes.archived = 0
GROUP BY notes.id
ORDER BY notes.updated_at DESC;
```

- `INNER JOIN` 只返回两边都匹配的行。
- `LEFT JOIN` 保留左表所有行，没有标签的笔记仍会出现。
- `GROUP BY` 把多行分组后交给 `COUNT`、`SUM`、`MAX` 等聚合函数。

## 7. 事务

事务保证一组操作要么全部成功，要么全部回滚。新建笔记并关联标签是一个业务操作：

```ts
function runInTransaction<T>(operation: () => T): T {
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

runInTransaction(() => {
  insertNote.run(note.id, note.title, '', now, now);
  for (const tagId of tagIds) insertNoteTag.run(note.id, tagId);
});
```

`BEGIN IMMEDIATE` 在开始时获取写事务，避免执行到一半才发现写锁不可用。事务应当尽量短，不要在里面等待网络请求或用户输入。

## 8. WAL 与并发

WAL（Write-Ahead Logging）把新写入先放到日志，允许 reader 继续读取稳定快照：

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

- WAL 改善一边读一边写，不会创造多 writer。
- `busy_timeout` 让锁短暂被占用时等待，而不是立即失败。
- 长事务会持续占锁并阻止 checkpoint，要从业务流程上缩短。

## 9. 索引

查询经常按 `archived` 过滤并按 `updated_at` 排序：

```sql
CREATE INDEX notes_active_updated_at_idx
ON notes (updated_at DESC)
WHERE archived = 0;
```

这是部分索引，只包含未归档数据。索引不是越多越好：每个索引都占空间，写入时也要维护。

```sql
EXPLAIN QUERY PLAN
SELECT id, title
FROM notes
WHERE archived = 0
ORDER BY updated_at DESC;
```

先根据真实查询建索引，再看 query plan，不要猜测。

## 10. Migration

schema 不能只修改初始 `CREATE TABLE`，因为已存在的用户数据库不会重建。每次变更要记录为只执行一次的 migration：

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;
```

```ts
interface Migration {
  name: string;
  migrate(database: DatabaseSync): void;
}

const migrations: readonly Migration[] = [
  {
    name: '001_create_notes',
    migrate(database) {
      database.exec('CREATE TABLE notes (...) STRICT');
    },
  },
  {
    name: '002_add_notes_search_index',
    migrate(database) {
      database.exec('CREATE INDEX notes_title_idx ON notes (title)');
    },
  },
];
```

runner 对每条未记录 migration 开事务，执行成功后再写入 `schema_migrations`。

Migration 原则：

1. 已发布 migration 不修改，用新 migration 修正。
2. 名称全局唯一且顺序可读。
3. schema 变更和数据回填要考虑旧数据量。
4. 在真实旧版数据库副本上验证升级。
5. 大变更前做可恢复备份。

## 11. 复杂 schema 变更

某些修改需要用新表替换旧表：

```sql
BEGIN IMMEDIATE;

CREATE TABLE notes_new (
  -- 新 schema
) STRICT;

INSERT INTO notes_new (...)
SELECT ... FROM notes;

DROP TABLE notes;
ALTER TABLE notes_new RENAME TO notes;

COMMIT;
```

执行前要处理外键、索引、trigger 和 view，并用 `PRAGMA integrity_check` 验证完整性。不要在没有备份和真实数据演练的情况下做破坏性变更。

## 12. JSON、全文搜索和 BLOB

- 可查询且结构稳定的数据优先正常列/关系，不要全塞 JSON。
- 可变配置或原始外部响应可以存 TEXT JSON，读出时验证。
- 搜索大量文本时考虑 FTS5，不要默认用 `%keyword%` 扫全表。
- 大图片/视频通常存文件系统，数据库存元数据和受约束的相对路径。

## 13. 备份与完整性

开启 WAL 后可能同时存在主文件、`-wal` 和 `-shm`。不要在连接正在写时只复制主文件当备份。优先使用 SQLite backup API，或在正确关闭连接、checkpoint 后复制。

```sql
PRAGMA quick_check;
PRAGMA foreign_key_check;
```

## 14. 常见错误

| 错误                 | 改法                             |
| -------------------- | -------------------------------- |
| 拼接 SQL 值          | prepare + bind                   |
| 多步写入不开事务     | 使用短事务                       |
| 声明外键但没启用检查 | 每个连接启用 foreign keys        |
| 只修改初始 schema    | 追加 migration                   |
| 为每个列建索引       | 根据真实查询和 query plan 建索引 |
| 事务内等网络         | 网络与数据库事务分开             |
| WAL 模式只复制主文件 | 使用 backup API 或正确关闭后备份 |

## 15. 练习

为桌面笔记应用建数据层：

1. 创建 `notes`、`tags`、`note_tags` 三张 STRICT 表。
2. 所有值使用预编译语句绑定。
3. 新建笔记 + 标签关联放在一个事务。
4. 为活跃笔记列表建索引，并用 query plan 验证。
5. 新增一条 migration，为笔记加 `pinned` 状态。
6. 从旧 schema 升级，确认原数据保留且完整性检查通过。

下一步学习 [AI SDK](./ai-sdk)，进入模型生成、流式数据和工具调用。
