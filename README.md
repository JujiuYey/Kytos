# ip-creator

给个人 IP 出图的桌面 app（Tauri 2 + Vue 3 + Rust）。

**写提示词用 DeepSeek，画图用 gpt-image-2。** 两个模型、两个 key、两条完全独立的路。

---

## 最重要的一件事：工具和数据是两个仓库

| | 是什么 | 在哪 |
|---|---|---|
| **ip-creator**（本仓库） | 工具。界面、API 客户端、路径推导。 | `~/Projects/ip-creator` |
| **角色抽卡** | 数据。角色设定、提示词、抽出来的图、API key。 | `~/Desktop/角色抽卡`（独立 git 仓库） |

**app 不搬内容，只是指过去。** 项目目录在「设置」里选，存 localStorage（`gacha` store 的 `projectRoot`）。以后做第二个 IP 就再开一个目录，代码一行不改。

改这个仓库的代码之前，先去数据仓库里看一眼 `ip.md` 和 `AGENTS.md`——那两份文件不是文档，是**喂给 DeepSeek 的 system prompt**（见下面）。

### 数据目录长这样

```
<项目根>/
  ip.md            阿九是谁、识别锚点、他该演什么   ← 「角色」页读写这个
  AGENTS.md        提示词四段结构 + 写作四规则       ← 「策略」页读写这个
  角色/            prompt/*.md  images/  定妆照.png  角色表.png
  表情/            prompt/*.md  images/
  动作场景/         prompt/*.md  images/
  .env             APIMART_API_KEY=sk-xxx    ← 生图
                   DEEPSEEK_API_KEY=sk-xxx   ← 写字
  scripts/draw.py  老的命令行入口，还留着，和 app 共用同一份 md 和 .env
```

**类目是扫出来的，不是写死的。** 根目录下任何含 `prompt/` 子目录的文件夹就算一个类目。以后加「道具」「分镜」不用改代码。

---

## 两个模型，两条路

| | 干什么 | key | Rust 模块 | 前端页面 |
|---|---|---|---|---|
| **DeepSeek** | 写提示词 md（纯文本） | `DEEPSEEK_API_KEY` | `gacha/deepseek.rs` | 写卡 / 角色 / 策略 |
| **APIMart（gpt-image-2）** | 出图 | `APIMART_API_KEY` | `gacha/apimart.rs` | 抽卡 |

**这两个模块之间没有任何调用关系**，共用的只有 `error.rs`。别把它们缝到一起。

**DeepSeek 不看图。** `deepseek-chat` / `deepseek-reasoner` 都不吃图片输入。想让模型看抽出来的效果再改词，得换多模态模型——那是另一个设计，不在这一版里。

---

## 这是图生图，不是文生图

**每次出图都会把 `角色/定妆照.png` 和 `角色/角色表.png` 作为 `image_urls` 发过去。** 角色长什么样由这两张图携带。

所以**提示词里一个字都不要描述他的长相**——脸、眼睛、发型、身材、衣服。文字一描述就会跟参考图抢方向盘，把画面拽偏。这条约束同时约束着 DeepSeek（写在 system prompt 的硬约束里）和写 md 的人。

唯一的例外：`角色/prompt/00-定妆照.md`（重抽角色形象本身）默认**不带**参考图——带了的话新形象会被旧定妆照拽回去。这个默认值写死在 `views/gacha/components/prompt-editor.vue` 里。

---

## 界面：五页

| 页面 | 干什么 |
|---|---|
| **抽卡** | 三栏：选卡 / 改 md + 抽 / 看抽出来的图。挑中一张可以「设为定妆照 / 角色表」。 |
| **写卡** | 两栏：填类目 + 卡名 + 意图 → DeepSeek 流式写出四段 md → 人改 → 「保存并去抽卡」。 |
| **角色** | 编辑数据仓库里的 `ip.md`。 |
| **策略** | 编辑数据仓库里的 `AGENTS.md`。 |
| **设置** | 项目目录、两个 API key、DeepSeek 模型名。 |

侧边栏分三组（抽卡 / 写卡 / 系统），由 `src/data/menu-data.ts` 驱动，路由是从菜单自动生成的（`src/router/index.ts`）。加页面 = 往 `menus` 数组里加一项 + 在 `src/views/` 下建对应文件。

### DeepSeek 的 system prompt 怎么拼

`deepseek.rs::build_messages()`，五块，按顺序：

1. 任务声明（「你是『表情』类目的提示词作者」）
2. **`ip.md` 全文**，一字不改
3. **`AGENTS.md` 全文**，一字不改
4. **同类目的 2 个现成 md 当范例**（`project.rs::load_examples`，不够就从别的类目补）
5. 硬约束复述 + 输出要求

**第 4 块不是锦上添花，是必须的。** 【1. 身份锁定】那一段是逐字照抄的样板（「参考图里的这个人，就是要画的人……不要复制参考图的背景和排版，只把这个人搬过来」）。`AGENTS.md` 里只有个模板片段，模型看了会自己发挥、会漏掉「不要复制背景」那句——而那句是必须有的。范例里有原文，让它照抄最省事。

新类目下面一个 md 都没有时，范例从别的类目借——否则模型没有身份锁定原文可抄。`build_messages` 有回归测试盯着这几条。

---

## 不可协商的约定

**这十条是几十张卡换来的。改了就是另一个产品。**

抽卡（1-5）：

1. **路径约定**：`<类目>/prompt/x.md` → `<类目>/images/x-01.png`。输出目录、文件名、画幅全部从 md 路径推导，界面上不给用户填。
2. **编号只往后排，永不覆盖**：抽之前扫 `images/` 里已有的 `x-NN.png`，取最大值 +1。抽出来的卡是资产。
3. **默认带角色参考图**（例外见上面「图生图」那节）。
4. **md 顶部的 `<!-- size: --> / <!-- resolution: -->` 是指令，发给模型前必须剥掉**。默认 `16:9` / `1k`。
5. **「挑中才升级为基准」是人的动作**。app 只提供按钮，不提供「自动选最好的一张」。

写卡（6-10）：

6. **提示词的单一真相是 md 文件。** app 不维护草稿库、不存历史版本——那会立刻分裂出第二个真相源。没保存就是没有。
7. **指令行由 app 拼，不由模型写。** 模型只写正文，存盘前 app 把 `<!-- size: -->` 拼到最前面（`stores/writer.ts::saveAndGo`）。
8. **不覆盖已有的 md。** 撞名直接报错，不给「要不要覆盖」的选项。
9. **生成完不自动抽卡。** 人看一眼、改一改、按保存，自己去点抽卡。
10. **DeepSeek 不看图。**

贯穿全部十条的一句话：**人挑卡，模型不挑；人拍板，模型不拍板。**

---

## 代码地图

### 后端（Rust）

**所有 HTTP 都在 Rust，前端一行请求都不发。** key 不进前端，CSP 也不用为 `api.apimart.ai` / `api.deepseek.com` 开 `connect-src`。

```
src-tauri/src/gacha/
  project.rs    文件系统：扫类目、剥指令行、算下一个编号、读写 .env / ip.md / AGENTS.md、
                取范例、新建 prompt。全是纯函数或纯文件操作，测得动。
  apimart.rs    gpt-image-2：拼 payload、提交、轮询、抽 URL、下载。
  deepseek.rs   DeepSeek chat：拼 system prompt、SSE 流式解析、剥代码围栏。
  error.rs      ApiMartError —— 中文字符串，直接进 toast。
  mod.rs        Tauri 命令 + 事件 emit。
```

### 命令

```
scan_project(root)                              → Project（类目 / 基准图 / 两个 key 有没有配）
read_prompt(md_path) / write_prompt(md_path, raw)
create_prompt(root, category, name, raw)        → md_path（撞名报错，约定 8）
read_context(root) / write_context(root, kind, content)   kind = "ip" | "agents"
generate_prompt(req)                            → GenerateResult（DeepSeek 写 md，不落盘）
draw(req)                                       → DrawResult（出图 + 下载，dry_run 时只回 payload）
fetch_task(root, md_path, task_id)              → DrawResult（下载挂了之后取回，不重复扣费）
set_baseline(root, image_path, target)          target = "定妆照" | "角色表"
read_api_key / write_api_key / delete_api_key / delete_env_key
```

### 事件

```
draw://progress    { stage, message, task_id? }   stage: building|submitted|polling|downloading|done|failed
deepseek://delta   { content, reasoning }         reasoning 只有 reasoner 模型有，chat 恒为空串
deepseek://error   { message }
```

**`submitted` 那条必须带 task_id，URL 一拿到就先 emit。** 任务完成 = 钱已经花了，图的链接必须先落到界面上——下载再怎么挂都不能丢图。

### 前端（Vue 3 + Pinia + shadcn-vue）

```
src/stores/
  gacha.ts      项目目录（持久化）、扫描结果、当前选中的卡、抽卡状态、日志
  writer.ts     写卡页：类目 / 卡名 / 画幅 / 意图 / 草稿 / 思维链；generate() 和 saveAndGo()
  context.ts    ip.md + AGENTS.md 的内容和路径
  app.ts        主题、DeepSeek 模型名（持久化到 localStorage 的 app-setting）

src/views/{gacha,writer,character,strategy,settings}/
  每页一个 index.vue 当编排层，实际内容在同目录的 components/ 下
```

UI 组件是 shadcn-vue（`src/components/ui/`），**自动导入，不用写 import**（`unplugin-vue-components`）。

图片显示走 Tauri asset protocol（`convertFileSrc`），URL 后面缀 `?v=<mtime>`——不然覆盖了定妆照，界面上还是旧图。

---

## 跑起来

```bash
pnpm install
pnpm tauri:dev              # 起 app
pnpm build                  # vue-tsc + vite build，提 PR 前必须过
cd src-tauri && cargo test  # Rust 单测（纯函数，不调 API、不花钱）
```

第一次跑：进「设置」选项目目录（`~/Desktop/角色抽卡`），填两个 API key，填 DeepSeek 模型名。

---

## 坑

- **抽卡花钱。** 验证用 `draw` 的 `dry_run: true`（不调 API、不扣费，只回 payload 预览）。**真抽卡交给人点。**
- **图没下下来，别重抽。** 任务已经完成、钱已经花了。用界面上的「用 task_id 取回」（`fetch_task`），不重复扣费。
- **DeepSeek 模型名是手填的，没有默认值。** 设置里空着就会拿空字符串去请求，DeepSeek 报 400。`src/views/settings/components/deepseek-model.vue` 里给了官方模型列表的链接。
- **SSE 缓冲区必须是 `Vec<u8>`，不能是 `String`。** HTTP chunk 会从任意字节切开，一个中文字 3 个字节，按 `String::from_utf8_lossy(&chunk)` 逐块拼会把切在边界上的汉字拼成 `�`。`deepseek.rs::stream_chat` 里是字节缓冲、按 `\n` 切出完整行、**对完整的行**才解码 UTF-8。别改回去。
- **`scripts/draw.py` 还留着**，没删。它和 app 共用同一份 md、同一个 `.env`、同一套路径约定，天然兼容。**app 写出来的 md 必须能被它跑通**——这是「写卡页只是个更快的编辑器」这句话的底线。

---

## 文档

| | |
|---|---|
| [docs/spec-抽卡.md](docs/spec-抽卡.md) | 抽卡：命令契约、三栏布局、约定 1-5 |
| [docs/plan-抽卡.md](docs/plan-抽卡.md) | 抽卡的实施步骤和验收 |
| [docs/spec-写卡.md](docs/spec-写卡.md) | 写卡：DeepSeek 接入、system prompt 拼法、约定 6-10 |
| [docs/plan-写卡.md](docs/plan-写卡.md) | 写卡的实施步骤和验收 |

数据仓库里的 `AGENTS.md` 和 `ip.md` 也读一遍。**改那两个文件等于改模型的行为**——它们是 system prompt，不是说明书。
