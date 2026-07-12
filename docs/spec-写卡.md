# SPEC：写卡（DeepSeek 写提示词）

配套 [spec-抽卡.md](./spec-抽卡.md)。抽卡管「画」，写卡管「写」。

## 一句话

**提示词让 DeepSeek 写，图让 gpt-image-2 画。两个模型、两个 key、两条路，谁也不碰谁。**

现在 app 只有「画」这一半：md 已经躺在 `prompt/` 里了，app 负责选卡、抽卡、看图、设基准。「写」那一半还在人和 AI 的聊天窗口里，没进 app。这份 spec 补的就是它。

## 核心认知：那两份 md 不是文档，是 system prompt

`~/Desktop/角色抽卡` 根目录下有两份文件，一直被当成「给人看的说明」：

| 文件 | 内容 | 在这里的身份 |
|---|---|---|
| `ip.md` | 阿九是谁、识别锚点、三个表演工具、他该演什么 | **角色设定**——决定画面里发生什么 |
| `AGENTS.md` | 四段结构、写提示词的四条规则、脚本的坑 | **写作规范**——决定提示词长什么样 |

它们是几十张卡换来的。**喂给 DeepSeek，它就能照着写。** 所以 app 里要有两个页面来编辑它们——不是抄一份进 app，是**直接读写项目目录里那两个文件**，跟 md、`.env` 一样，单一真相在磁盘上。

沿用抽卡那条：**ip-creator 是工具，角色抽卡是数据。**

## 边界

做：

- 「写卡」页：给一句意图（「蹲在坑边上往里看」）→ DeepSeek 吐出四段结构的 md → 人改 → 存成 `<类目>/prompt/x.md` → 去抽卡
- 「角色」页：编辑 `ip.md`
- 「策略」页：编辑 `AGENTS.md`
- 设置页补一节：DeepSeek key + 模型选择

不做（第一版）：

- 让 DeepSeek 改写已有的 md（抽卡页的编辑器已经能手改了，先看看够不够）
- 让 DeepSeek 看抽出来的图再改提示词（它是文本模型，见下面第 10 条）
- 多轮对话、聊天式改稿
- 生成完自动抽卡

## 数据在哪

全在项目根目录，跟抽卡共用：

```
<项目根>/
  ip.md          ← 角色页读写这个
  AGENTS.md      ← 策略页读写这个
  角色/ 表情/ 动作场景/   prompt/*.md  images/
  .env           APIMART_API_KEY=sk-xxx     ← 生图
                 DEEPSEEK_API_KEY=sk-xxx    ← 写字
```

两个 key 同一个 `.env`，两个名字。脚本那边只认 `APIMART_API_KEY`，加一行不影响它。

## 不可协商的约定

抽卡那五条继续有效。写卡再加五条：

6. **提示词的单一真相是 md 文件。** DeepSeek 生成的东西必须落成 `<类目>/prompt/x.md` 才算数。app 不维护「草稿库」「历史版本」——那会立刻分裂出第二个真相源。没保存就是没有。
7. **指令行由 app 拼，不由模型写。** `<!-- size: -->` / `<!-- resolution: -->` 是给脚本读的机器指令，让模型去写它只会写错。模型只写正文，app 在存盘前把指令行拼到最前面。
8. **不覆盖已有的 md。** 撞名直接报错（「已经有这张卡了」），不给「要不要覆盖」的选项。提示词是资产，跟 `images/` 里的卡一样，只往后排。
9. **生成完不自动抽卡。** 人看一眼、改一改、按保存，自己去点抽卡。延续「人挑卡，你不挑」——现在是「人拍板，模型不拍板」。
10. **DeepSeek 不看图。** `deepseek-chat` / `deepseek-reasoner` 都不吃图片输入。想让它看抽出来的效果再改词，就得换多模态模型，那已经不是「提示词用 DeepSeek 写」这个设计了。要做另开一版。

## 后端（Rust）

跟 apimart 一样：**HTTP 全在 Rust，key 不进前端，CSP 不用为 `api.deepseek.com` 开 `connect-src`。**

新增 crate：`futures-util`（流式解析）。`reqwest` 加 `stream` feature。

### 模块

```
src-tauri/src/gacha/
  deepseek.rs   ← 新：chat 客户端 + system prompt 拼装
  project.rs    ← 加：读写 ip.md / AGENTS.md、新建 prompt、取范例
  mod.rs        ← 加：4 个命令
```

`deepseek.rs` 和 `apimart.rs` 之间**没有任何调用关系**，共用的只有 `error.rs`。

### 命令契约

```rust
// 上下文：ip.md + AGENTS.md
read_context(root: String) -> Context
struct Context {
  ip: String, agents: String,           // 全文（文件不存在时是空串）
  ip_path: String, agents_path: String, // 绝对路径，界面上显示「在改哪个文件」
}
write_context(root: String, kind: String, content: String) -> ()
// kind 只接受 "ip" | "agents"

// 生成。async，流式 emit。不写任何文件。
generate_prompt(req: GenerateRequest) -> GenerateResult
struct GenerateRequest {
  root: String,
  category: String,     // "表情"，用来挑范例
  name: String,         // "11-摆烂"，只是塞进 user message 当上下文
  intent: String,       // "蹲在坑边上往里看"
  model: String,        // "deepseek-chat" | "deepseek-reasoner"
}
struct GenerateResult {
  md: String,           // 正文，不含指令行
  model: String,
}

// 落盘。撞名报错，不覆盖（约定 8）。
create_prompt(root: String, category: String, name: String, raw: String) -> String  // 回 md_path
```

`scan_project` 的 `Project` 加一个字段：`has_deepseek_key: bool`。和 `has_api_key` 一样，只回 true/false。

key 的读写复用现有那套，把 `.env` 的读写抽成 `read_env_key(root, name)` / `write_env_key(root, name, value)`，`APIMART_API_KEY` 和 `DEEPSEEK_API_KEY` 各调各的。

### 流式事件

DeepSeek 写一张卡要 20-60 秒（reasoner 更久）。**一个转圈的按钮撑不住这个时长**，必须边写边显示。

生成期间 emit `deepseek://delta`：

```ts
{ content: string,     // 正文增量
  reasoning: string }  // 思维链增量（只有 deepseek-reasoner 有，chat 恒为空串）
```

### system prompt 怎么拼

这是整个功能的核心。四块，按顺序：

```
1. 任务声明     你是「<类目>」的提示词作者，你写的 md 会被原样发给 gpt-image-2 出图
2. ip.md 全文    ← 角色页里的内容，一字不改
3. AGENTS.md 全文 ← 策略页里的内容，一字不改
4. 同类目的 2-3 个现成 md（剥掉指令行）
5. 硬约束复述 + 输出要求
```

**第 4 块（范例）是必须的，不是锦上添花。** 理由：

- 【1. 身份锁定】那一段是**逐字照抄的样板**（「参考图里的这个人，就是要画的人……不要复制参考图的背景和排版，只把这个人搬过来」）。AGENTS.md 里只有个模板片段，模型看了会自己发挥、会改写、会漏掉「不要复制背景」那句——而 AGENTS.md 白纸黑字说了那句**必须有**。范例里有原文，让它照抄最省事。
- 那 22 个 prompt 是几十张卡换来的 house style，比任何文字规范都准。

**范例不够 2 个就从别的类目补。** 新类目（比如以后加「道具」）下面一个 md 都没有，模型就没有身份锁定的原文可抄——这是硬伤，必须兜底。

第 5 块把最容易违反的几条从 AGENTS.md 里拎出来复述一遍（图生图不描述长相、身份锁定照抄、用正面句、只写视觉信息、四段结构），再加输出要求：**只输出 md 正文，不要代码围栏、不要开场白、不要解释、不要写指令行。**

模型真要是套了 ```` ``` ```` 围栏，Rust 侧剥掉——别指望模型 100% 听话。

### 参数

- 默认 `deepseek-chat`，设置里可以切 `deepseek-reasoner`。
- `temperature: 1.3`（DeepSeek 官方给「通用对话/创作」的档位）。**`deepseek-reasoner` 不传 temperature**，它不支持。
- HTTP 超时 300 秒——reasoner 想得久。

### 错误

照抄 apimart 的路子：中文字符串，直接进 toast。「没找到 DeepSeek key」「找不到 ip.md」「已经有这张卡了：11-摆烂.md」。

## 前端

### 侧边栏

```
抽卡    ← 已有
写卡    ← 新
角色    ← 新（ip.md）
策略    ← 新（AGENTS.md）
设置    ← 补一节
```

### 写卡页：两栏

```
┌──────────────────────┬────────────────────────────┐
│ 类目  [表情 ▾]        │  草稿（流式写进来，能改）    │
│ 名字  [11-摆烂    ]   │  ┌──────────────────────┐ │
│ 画幅  [1:1▾] [1k▾]   │  │【1. 身份锁定】        │ │
│                      │  │ 参考图里的这个人...   │ │
│ 意图                 │  │                      │ │
│ ┌──────────────────┐ │  │【2. 场景】           │ │
│ │蹲在坑边上往里看， │ │  │ 他蹲在...            │ │
│ │不是举牌警告，    │ │  │                      │ │
│ │是好奇            │ │  │【3. 批注】...        │ │
│ └──────────────────┘ │  │【4. 画风收尾】...    │ │
│                      │  └──────────────────────┘ │
│ [ 生成 ]  deepseek-chat│  [ 保存并去抽卡 ]         │
│                      │                            │
│ ▸ 思维链（reasoner）  │                            │
└──────────────────────┴────────────────────────────┘
```

- **画幅跟着类目走**：选「表情」自动切 `1:1`，其他 `16:9`（AGENTS.md 的约定）。人可以改。存盘时拼成指令行。
- **名字自动建议下一个编号**：扫同类目里 `NN-` 前缀的最大值 +1，两位补零（表情有 00-09 → 建议 `10-`）。人补后半截。
- **「保存并去抽卡」**：`create_prompt` → 重扫 → 选中这张 → 跳 `/gacha`。存完就在抽卡页的中栏里，接着改、接着抽。
- 思维链折叠起来，默认收着。`deepseek-chat` 下整块不显示。

### 角色页 / 策略页

一个东西两份配置：一个大 textarea + 保存按钮 + 顶上一行「正在改 `<绝对路径>`」。共用一个 `context-editor.vue`。

不做 markdown 预览、不做富文本。**这两个文件是喂给模型的，不是给人排版的**，看见什么就是模型看见什么。

顶上挂一句人话，说清它的作用：

- 角色页：「阿九是谁、他该演什么。写卡时作为 system prompt 发给 DeepSeek。」
- 策略页：「提示词怎么写。写卡时作为 system prompt 发给 DeepSeek。」

### 设置页

APIMART key 那一节下面照抄一份：DeepSeek key（写 `.env` 的 `DEEPSEEK_API_KEY`，只显示 `sk-****`），加一个模型下拉（`deepseek-chat` / `deepseek-reasoner`，存 pinia）。

## 验收：拿现有内容跑通

1. 角色页打开，出 `ip.md` 全文；改一个字保存，`git diff` 只动那一个字。策略页同理。
2. 写卡页选「表情」，画幅自动变 `1:1`，名字自动建议 `10-`。
3. 意图填「蹲在坑边上往里看，不是举牌警告，是好奇」，点生成：**文字一个字一个字流出来**，不是等 40 秒一次性蹦出来。
4. 生成的草稿里：**有完整的四段**、【1. 身份锁定】跟范例逐字一致（含「不要复制参考图的背景和排版」）、**全文没有一个字描述他的长相**、没有指令行、没有 ``` 围栏。
5. 保存，落到 `表情/prompt/10-xxx.md`，顶上两行是 `<!-- size: 1:1 -->` / `<!-- resolution: 1k -->`，界面跳到抽卡页且这张卡是选中的。
6. 再存一次同名的，报「已经有这张卡了」，文件没被动过。
7. 拿这张新 md 跑 `python3 scripts/draw.py 表情/prompt/10-xxx.md --dry-run`，**脚本认**——app 写出来的 md 和人写的 md 没有区别。

第 7 条是这个功能的底线：**写卡页只是个更快的编辑器，它产出的东西必须和手写的完全同构。**
