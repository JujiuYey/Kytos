---
title: 认识 SQLite 跟 Kytos
description: 给写过 Postgres / MySQL 的人——SQLite 在 Kytos 里怎么用、有什么不一样。
---

# 认识 SQLite 跟 Kytos

Kytos 不引外部数据库，**所有结构化数据存 SQLite**——一份本地文件、无服务器、零进程。本页让"碰过 Postgres / MySQL 但没用过 SQLite"的人 20 分钟内建立正确心智，再读 [数据库与迁移](./database) 那种操作细节。

## 一句话总结

**SQLite 是 C 写的内嵌数据库**，不是一个服务。Kytos 把它当"二进制文件 + 一组 SQL 表"用。文件就是数据库，进程就是连接——没有 daemon、没有连接池、没有"连接不上"。

## 为什么是 SQLite（而不是 Postgres）

| 维度        | Postgres / MySQL                           | SQLite（Kytos 选这个）      |
| ----------- | ------------------------------------------ | --------------------------- |
| 形态        | 服务器进程                                 | 嵌入式库                    |
| 部署        | 需要装服务、起 daemon                      | 复制文件就走                |
| 多写并发    | 几十到上千连接                             | 一次一个写者（用 WAL 缓解） |
| 网络        | 必须 TCP/IP                                | 没有网络层                  |
| 数据所有权  | 容易默认放云                               | 文件在你指定的工作区里      |
| Schema 演进 | migration 工具多（Drizzle、Prisma、Knex…） | 自己手写 migration runner   |

Kytos 选 SQLite 的三个直接原因：

1. **桌面应用不需要并发**——只有一个用户、一台机器
2. **作品数据归用户所有**——`kytos.sqlite3` 文件就在用户选的目录里，git 友好
3. **API Key 不进作品目录**——靠**两个数据库**实现隔离

## Kytos 用 `node:sqlite`，不是 `better-sqlite3`

注意这两个不一样：

| 库               | 状态                     | 性能                                 |
| ---------------- | ------------------------ | ------------------------------------ |
| `node:sqlite`    | Node.js v22.5+ 内置      | 跟 better-sqlite3 同一档（同步 API） |
| `better-sqlite3` | 第三方、需 node-gyp 编译 | 同上                                 |
| `sqlite3`（npm） | 第三方、async API        | 慢一些                               |

Kytos 用**内置 driver**——这意味着**不需要 native 编译**，跨平台装机少一个坑。看 `electron/storage/database.ts:4`：

```ts
import { DatabaseSync } from 'node:sqlite';
```

`DatabaseSync` 是同步 API——你调 `db.prepare(...).get(...)` 立刻返回值，没有 callback、没 `await`。Electron 主进程 Node 上下文里用同步 API 没代价，不会卡 UI。

::: tip 为什么 sync API 在 Electron 里是好事
Renderer 永远不直接碰 SQLite。Sync 在主进程跑（Node 的 v8::Isolate 上下文）跟异步没区别，反而代码简单——不用写一堆 `await` 链或 `Promise` 包装。
:::

## 两个数据库不是 SQLite 的特性，是 Kytos 的设计

很多人以为"Kytos 用一个 SQLite"，实际是**两个独立文件**。这不是 SQLite 自带的功能，是 Kytos 切分的：

| 数据库   | 文件                | 位置                  | 保存什么                                         |
| -------- | ------------------- | --------------------- | ------------------------------------------------ |
| 应用级   | `kytos-app.sqlite3` | Electron 用户数据目录 | 当前工作区路径、主题、默认模型、加密后的 API Key |
| 工作区级 | `kytos.sqlite3`     | 用户选择的作品目录    | 角色、表情、视觉资产、插画主题和版本、故事、分镜 |

为什么这样切？两个直接效果：

1. **切换工作区不丢凭据**：跟同事共享工作区时你的 API Key 不会跟过去
2. **可独立版本控制 / 备份**：作品目录里的 `.sqlite3` 是普通文件

具体的连接代码、migration runner 在 [数据库与迁移](./database)。本页不停留。

## 三个会被新手绊倒的开关

打开 `electron/storage/database.ts:28-32` 这种初始化代码：

```ts
const database = new DatabaseSync(filePath, {
  enableDoubleQuotedStringLiterals: false,
  enableForeignKeyConstraints: true,
  timeout: 5000,
});
database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
```

四个开关都有用意：

| 开关                               | 值      | 为什么这样                                                                                 |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `enableDoubleQuotedStringLiterals` | `false` | SQLite 默认能用 `"foo"` 当字符串——是 SQL 标准偏差。关掉，强制用 `'foo'`，跟其他 SQL 库一致 |
| `enableForeignKeyConstraints`      | `true`  | SQLite **默认不开**外键约束（历史包袱）。打开才让 `FOREIGN KEY (...)` 真的生效             |
| `timeout`                          | `5000`  | 获取写锁超过 5 秒抛错。SQLite 一次一个写者，要有失败反馈                                   |
| `PRAGMA journal_mode = WAL`        | —       | 写不阻塞读。多进程 / 多连接场景必备                                                        |
| `PRAGMA synchronous = NORMAL`      | —       | 牺牲一点崩溃安全性换速度。桌面应用可以接受                                                 |

::: warning STRICT 模式
所有 `CREATE TABLE` 都标了 `STRICT`（看 `electron/storage/app-database.ts:18-26`）。这是 Kytos 加的——SQLite 默认会默默转换类型（比如 `INSERT INTO foo (x) VALUES ('not an int')` 把字符串塞进 INTEGER 列只会 warning）。**STRICT 模式直接报错**——保护脏数据不溜进去。
:::

## 跟"普通 SQL 数据库"思路的不同点

如果你平时写 Postgres，会被这些绊倒：

**没有 boolean 类型**——SQLite 用 INTEGER 0/1。所有 Kytos 的 boolean 列都长这样：

```sql
story_ready INTEGER NOT NULL CHECK (story_ready IN (0, 1))
```

**没有原生 datetime 类型**——存 ISO 8601 字符串：

```sql
created_at TEXT NOT NULL  -- ISO 8601
```

**没有原生 JSON 列**——用 TEXT + `JSON_EXTRACT`：

```sql
messages_json TEXT NOT NULL  -- 解析时 JSON.parse
```

**ALTER TABLE 限制多**——SQLite 不支持 `DROP COLUMN`、不直接支持改约束。Kytos 处理方式是**永远不删字段**，新字段就 additive migration。

## 读 SQLite 的正确姿势

读 Kytos 源码找 SQL 时，按这个顺序找：

```text
1. CREATE TABLE    ← 看 schema
2. INSERT / UPDATE ← 看修改
3. SELECT          ← 看查询
4. WHERE / ORDER BY ← 看索引机会
5. PRAGMA          ← 看性能配置
```

每张表都在**领域 schema 文件**里——`electron/services/story/schema.ts`、`electron/services/character-library/store.ts`、`electron/services/illustration/store.ts` 等。Migration 数组在同一个 schema 文件里，跟着表走。

> 注意 Kytos **没有 query builder**（不用 Drizzle / Prisma），全是手写 SQL。这是有意的：桌面应用规模小，TS 类型在 `shared/` 已经管得严，SQL 用一行字符串写反而透明。

## 下一步读

- [数据库与迁移](./database) —— 5 层结构、migration runner、加表流程
- [本地开发](./development) —— 怎么验证改动
