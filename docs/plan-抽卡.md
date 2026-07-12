# PLAN：抽卡应用实施步骤

配套 [spec-抽卡.md](./spec-抽卡.md)。四步，每步跑得起来、验得了，不跨步。

一条贯穿始终的原则：**抽卡花钱。全程用 `dry_run` 验，真抽卡交给人点。**

---

## 第 0 步：清干净脚手架

ip-creator 现在是 `bridge-todesk` 模板，带着一整套用不上的业务页（ollama 聊天、工作台图表、数据库配置）。留着它们，侧边栏里会一直挂着几个死链接。

**保留**：`layout/`、`components/ui/`（shadcn 全套）、`composables/use-theme.ts`、`lib/utils.ts`、路由机制（`menu-data.ts` 驱动）。

**删除**（按依赖顺序，先删页面再删被它们引用的东西）：

| 删什么 | 为什么 |
|---|---|
| `views/ai/ai-chat/`、`views/ai/prompt-template/` | 模板的聊天页 |
| `views/system/workspace/` | 模板的工作台 + 图表 |
| `views/system/app-setting/` | 换成我们自己的设置页 |
| `components/sag/sag-chat/` | 只被 ai-chat 用，且依赖 ollama store |
| `stores/conversations.ts`、`stores/ollama-config.ts` | 上面这些页面删了就没人用 |
| `services/ollama.ts`、`services/database/` | 同上 |
| `composables/use-generate-docx.ts`、`data/prompt-templates.ts` | 同上 |
| `api/*.ts`（project / test-unit / bridge / project-member） | 模板的后端接口，grep 过，没人引用 |

`components/sag/` 下的 `sag-form` / `sag-list` / `sag-tree` / `sag-data-table` 是通用组件，**留着**，虽然第一版用不上。

**顺手改名**：`package.json` 的 `bridge-todesk`、`tauri.conf.json` 的 `bridge-app`（productName / identifier / 窗口标题）全部改成 `ip-creator`。

**依赖瘦身**：npm 去掉 `openai`、`docx`、`@visactor/vchart`、`@tauri-apps/plugin-sql`；Cargo 去掉 `tauri-plugin-sql`、`mime_guess`、`dirs`，`lib.rs` 里删掉 `save_file_to_storage` / `ensure_storage_structure` 和 sql plugin 的注册。

**验收**：`pnpm tauri:dev` 起得来，窗口标题是 ip-creator，侧边栏空了或只剩设置，控制台没有报错。`pnpm build`（含 `vue-tsc`）过。

---

## 第 1 步：Rust 后端，先跑通 dry-run

这一步不碰界面，纯移植 Python。

1. Cargo 加 `reqwest`（`rustls-tls` + `json`）、`base64`、`regex`、`tokio`。
2. `gacha/project.rs`——移植 `draw.py` 的纯逻辑部分，这些全是可以直接测的函数：
   - `split_directives()`：剥 `<!-- size: -->` / `<!-- resolution: -->`
   - `resolve_output_dir()`：`<类目>/prompt/x.md` → `<类目>/images/`
   - `next_index()`：扫 `x-NN.png` 取最大值 +1
   - `scan_project()`：扫出含 `prompt/` 的目录当类目
3. `gacha/apimart.rs`——移植 `apimart.py`：`load_reference`（本地图转 base64 data URI，20M 上限、格式白名单）、`build_payload`、`submit_generation`、`poll_task`、`extract_image_urls`、`download_all`。
   **`download_file` 里那套 urllib 重试 + curl 兜底可以整个不要**——那是 macOS 自带 Python 的 SSL 坑，rustls 没这问题。
4. `gacha/mod.rs`——按 spec 的契约挂 tauri 命令，`draw` 里 emit `draw://progress`。

**验收**：`scan_project` 指向 `~/Desktop/角色抽卡`，回 3 个类目 22 张卡片。`draw` 带 `dry_run: true` 跑 `表情/prompt/06-慌了.md`，打出来的 payload 跟 `python3 scripts/draw.py 表情/prompt/06-慌了.md --dry-run` **逐字段对得上**：`size: 1:1`、`image_urls` 2 张、`prompt` 里没有 `<!-- -->`。

这个对照是这一步的全部意义——两边输出一致，才敢说移植没走样。

---

## 第 2 步：界面，选卡 + 看图 + 编辑

三栏（用现成的 `components/ui/resizable`）。

1. `stores/gacha.ts`：项目目录（持久化）、扫描结果、当前选中、抽卡状态、日志。
2. `views/gacha/index.vue` + 三个子组件（`prompt-list` / `prompt-editor` / `image-gallery`）。
3. `views/settings/index.vue`：选项目目录（`plugin-dialog`）、填 API key（写 `.env`）。
4. `menu-data.ts` 换成「抽卡」+「设置」两栏。
5. `tauri.conf.json` 开 asset protocol，CSP 的 `img-src` 加 `asset: http://asset.localhost`；图片 URL 缀 `?v=<mtime>`。

**先不接抽卡按钮**，这一步只读 + 编辑。

**验收**：点 `表情/06-慌了` 出提示词和已有的图；改画幅存盘，`git diff` 只动 md 顶部那一行；左栏张数（表情 10 / 动作场景 11 / 角色 0）跟 Finder 里数出来的一致。

---

## 第 3 步：抽卡 + 设为基准

1. 抽卡按钮接 `draw`，日志区实时显示进度事件。**`submitted` 一到就把 task_id 显示出来，URL 一到就显示出来** —— 下载挂了也不丢图。
2. 下载失败的：把 URL 和 task_id 显示在界面上，能一键复制，旁边给个「用 task_id 取回」（调 `fetch_task`，不重复扣费）。
3. 参考图开关，默认规则见 spec（只有 `00-定妆照.md` 默认关）。
4. 「设为基准」：hover 出按钮 → 确认框（说清覆盖哪个文件）→ `set_baseline` → 重扫。

**验收**（这一步要真花钱，人来点）：

- 抽 `表情/06-慌了` 一张，落到 `06-慌了-02.png`，**没覆盖 01**。
- 抽的过程中日志里能看到 task_id 和图的 URL。
- 选一张设为定妆照，`角色/定妆照.png` 变了，界面上的图跟着变（缓存击破生效）。

---

## 收尾

- `scripts/draw.py` 留着，不删。它和 app 共用 md、`.env`、路径约定，天然兼容，`--dry-run` 还是最便宜的校验手段。
- 角色抽卡那边的 `AGENTS.md` 补一句：现在有两条跑法，脚本和 app，约定不变。

## 不在这一版里

连抽 N 张、图片编辑、第二个 IP 的目录切换。都是加法，等第一版用顺手了再说 —— 尤其是连抽，得先知道实际抽卡节奏才知道该做成什么样。
