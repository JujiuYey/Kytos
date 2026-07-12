# SPEC：抽卡桌面应用

把 `~/Desktop/角色抽卡` 那套「改 `MD_FILE` → 点运行 → 去 Finder 翻图 → 手动复制覆盖」的流程，做成 ip-creator 里的界面操作。

## 一句话

**ip-creator 是工具，角色抽卡是数据。** app 不搬内容，只是指过去。

## 边界

做：

- 选卡片（左栏列出项目里所有 prompt）
- 抽卡（点一下，进度可见，图落回 `images/`）
- 看图（并排看这个 prompt 抽过的所有卡）
- 提示词在 app 里直接改（含画幅指令）
- 挑中「设为基准」（一键覆盖 `角色/定妆照.png` 或 `角色/角色表.png`）

不做（第一版）：

- 连抽 N 张
- 内置图片编辑、裁剪、放大
- 云端同步、多人协作
- **不做「自动挑卡」。** 挑哪张是人的活，见下面「不可协商的约定」。

## 数据在哪

内容留在 `~/Desktop/角色抽卡`，那是个独立 git 仓库，app 不碰它的历史。

app 里存一个「项目目录」路径（可换，以后做第二个 IP 就再开一个目录）。目录结构 app 不发明，直接沿用现有约定：

```
<项目根>/
  角色/     prompt/*.md  images/  定妆照.png  角色表.png
  表情/     prompt/*.md  images/
  动作场景/  prompt/*.md  images/
  .env      APIMART_API_KEY=sk-xxx
```

**类目是扫出来的，不是写死的。** 凡是根目录下含 `prompt/` 子目录的文件夹，就是一个类目。以后加「道具」「分镜」不用改代码。

## 不可协商的约定

这五条是几十张卡换来的，移植时一个字都不能改。改了就是另一个产品。

1. **路径约定**：`<类目>/prompt/x.md` → `<类目>/images/x-01.png`。输出目录、文件名、画幅全部从 md 路径推导，界面上不给用户填。
2. **编号只往后排，永不覆盖**：抽之前扫 `images/` 里已有的 `x-NN.png`，取最大值 +1。之前抽出来的卡是资产。
3. **默认带角色参考图**：`角色/定妆照.png` + `角色/角色表.png`，每次出图都作为 `image_urls` 发过去。这是图生图，不是文生图。
4. **md 顶部的 `<!-- size: --> / <!-- resolution: -->` 是指令，发给模型前必须剥掉**。默认 `16:9` / `1k`。
5. **「挑中才升级为基准」是人的动作**。app 只提供按钮，不提供「自动选最好的一张」。

## 后端（Rust）

**API 调用整个放 Rust，前端一行 HTTP 都不发。** 三个理由：

- `apimart.py` 里那个 macOS 自带 Python 的 SSL 握手坑（`EOF occurred in violation of protocol`，逼得加了 curl 兜底）在 reqwest + rustls 下根本不存在，兜底逻辑可以整个删掉。
- 轮询是长任务，放后端才能往界面推进度。
- API key 不进前端，CSP 也不用为 `api.apimart.ai` 开 `connect-src`。

新增 crate：`reqwest`（`rustls-tls`、`json`）、`base64`、`regex`、`tokio`。
删掉：`tauri-plugin-sql`、`mime_guess`、`dirs`，以及 `save_file_to_storage` / `ensure_storage_structure` 两个模板命令。

### 模块

```
src-tauri/src/
  gacha/apimart.rs   ← 移植 apimart.py：提交、轮询、抽 URL、下载
  gacha/project.rs   ← 移植 draw.py 的路径推导：扫类目、剥指令、算下一个编号
  gacha/mod.rs       ← tauri 命令
```

### 命令契约

```rust
// 扫描项目，一次拿全。左栏渲染只靠这一个调用。
scan_project(root: String) -> Project

struct Project {
  root: String,
  categories: Vec<Category>,      // 扫出来的，按目录名排序
  baselines: Baselines,           // 定妆照/角色表：存在与否、绝对路径、mtime
  has_api_key: bool,              // 只回 true/false，不回 key 本身
}
struct Category { name: String, prompts: Vec<PromptSummary> }
struct PromptSummary {
  name: String,                   // "06-慌了"
  md_path: String,                // 绝对路径
  size: String, resolution: String,  // 从 md 指令解析，缺省填 16:9 / 1k
  images: Vec<ImageRef>,          // 已抽出来的卡，按编号排
}
struct ImageRef { path: String, index: u32, mtime: u64 }   // mtime 用来做缓存击破

// 中栏编辑器
read_prompt(md_path: String) -> PromptDetail
struct PromptDetail {
  raw: String,        // md 原文，含指令行 —— 编辑器里显示的就是这个
  prompt: String,     // 剥掉指令后的正文 —— 真正发给模型的
  size: String, resolution: String,
}
write_prompt(md_path: String, raw: String) -> ()

// 抽卡。async，边跑边 emit 进度。
draw(req: DrawRequest) -> DrawResult
struct DrawRequest {
  root: String, md_path: String,
  no_ref: bool,                   // 默认值见下面「参考图开关」
  extra_refs: Vec<String>,        // 额外参考图，第一版界面不暴露，接口先留着
  size: Option<String>, resolution: Option<String>,  // None = 用 md 里的
  dry_run: bool,                  // true 时只回 payload，不调 API、不扣费
}
struct DrawResult {
  task_id: String,
  urls: Vec<String>,              // 图的 URL，约 24 小时后过期
  saved: Vec<String>,             // 落地的文件路径
  failed: Vec<FailedDownload>,    // 下载挂了的，带 url，界面上可复制
}

// 下载挂了之后取回，不重复扣费。task_id 从进度日志里拿。
fetch_task(root: String, md_path: String, task_id: String) -> DrawResult

// 覆盖基准。target 只接受 "定妆照" | "角色表"。
set_baseline(root: String, image_path: String, target: String) -> ()

// key 存项目目录的 .env（沿用现有约定，脚本和 app 共用一个 key 源）
read_api_key(root: String) -> Option<String>
write_api_key(root: String, key: String) -> ()
```

### 进度事件

抽卡期间 emit `draw://progress`：

```ts
{ stage: 'building' | 'submitted' | 'polling' | 'downloading' | 'done' | 'failed',
  message: string,
  task_id?: string }
```

**`submitted` 那一条必须带 task_id，而且 URL 一拿到就先 emit 出来。** 这是 `apimart.py` 里那条铁律的翻译版：任务完成 = 钱已经花了，图的链接必须先落到界面上，下载再怎么挂都不能丢图。

### 错误

所有命令的错误回中文字符串，直接进 toast。`ApiMartError` 那套措辞照抄（「找不到角色参考图」「参考图超过 20M」「没找到 API key」），已经打磨过了。

## 前端

### 布局：三栏

```
┌──────────┬─────────────────────────┬──────────────┐
│ 类目/卡片 │  md 编辑器               │  抽出来的卡   │
│          │                          │              │
│ 角色      │  [16:9 ▾] [1k ▾]        │  ┌────┐┌────┐│
│  定妆照   │  ☑ 带角色参考图          │  │-01 ││-02 ││
│  角色表   │                          │  └────┘└────┘│
│ 表情 (10) │  ┌────────────────────┐ │  ┌────┐      │
│  没劲 ×3  │  │ 参考图里的这个人... │ │  │-03 │      │
│  慌了 ×1  │  │                    │ │  └────┘      │
│ 动作场景  │  └────────────────────┘ │              │
│          │  [ 抽卡 ]                │  hover 出：   │
│          │                          │  设为定妆照/  │
│          │  ── 日志 ──              │  角色表       │
│          │  submitted: task_xxx     │              │
└──────────┴─────────────────────────┴──────────────┘
```

左栏卡片名后面缀已抽张数（`慌了 ×1`），一眼看出哪些还没抽过。

### 画幅：单一真相在 md 里

中栏顶上的 size / resolution 是两个 select，值从 md 指令解析。**改了立刻写回 md 顶部的 `<!-- size: -->`**，而不是只存在界面状态里。

这样 app 和 AI 写的 md 永远看到同一个值，`draw.py` 也还能跑。画幅跟着 md 走，不跟着界面走。

### 参考图开关

默认**带**。唯一的例外：md 是 `角色/prompt/00-定妆照.md`（重抽角色形象本身）时默认**不带** —— 带了的话新形象会被旧定妆照拽回去。

开关旁边挂一句人话解释，别让人猜。`角色表.md` 仍然默认带（它要照着定妆照画）。

### 图片显示

Tauri asset protocol（`convertFileSrc`）。`tauri.conf.json` 里开 `assetProtocol.enable` + `scope: ["**"]`，CSP 的 `img-src` 加 `asset: http://asset.localhost`。

**URL 后面缀 `?v=<mtime>`。** 不然覆盖了定妆照，界面上还是旧图。

### 设为基准：二次确认

覆盖 `定妆照.png` 是不可逆的（原文件没了）。点「设为定妆照」弹确认框，说清楚会覆盖哪个文件。

这一步慢一点是对的 —— 它是整个项目里影响面最大的动作，换了基准，后面所有卡的长相都跟着变。

### 设置页

- **项目目录**：dialog 选目录，存 pinia（localStorage 持久化）。没设时首屏引导去设。
- **API key**：读写项目目录的 `.env`。界面上只显示 `sk-****`，不回显明文。

## draw.py 怎么办

**留着，不删。** 它和 app 共用同一份 md、同一个 `.env`、同一套路径约定，天然兼容。`--dry-run` 仍然是最便宜的校验手段。

app 稳定跑一阵之后再决定要不要退役它。现在删掉只是给自己断后路。

## 验收：拿现有内容跑通

不写单测，用真数据验。项目里已经有 22 个 prompt、21 张抽出来的卡，够用了：

1. 指向 `~/Desktop/角色抽卡`，左栏应该出现 3 个类目、22 张卡片，张数对得上（表情 10、动作场景 11、角色 0）。
2. 点 `表情/06-慌了`，中栏出提示词、`1:1`、`1k`，右栏出已有的图。
3. 改一次 size 存盘，`git diff` 应该只动 md 顶部那一行指令。
4. `dry_run` 抽一次，payload 里 `image_urls` 是 2 张、`prompt` 里不含 `<!-- -->`。
5. 真抽一张（**这一步花钱，交给人点**），图落到 `表情/images/06-慌了-02.png`，编号没覆盖 01。
6. 选中一张，设为定妆照，`角色/定妆照.png` 变了，界面上的图也跟着变（缓存击破生效）。
