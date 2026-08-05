# Design: 表情编辑器工作区背景变浅

## Goals and non-goals

**Goal.** 让表情编辑器（`SagImageEditor`）的工作区背景整体变浅，覆盖用户点选的三处表面：

1. 整个编辑器页面背景（`main`，当前 `bg-background`）
2. 预览区背景（stage 容器，当前 `bg-muted/30`）
3. 画布透明棋盘格（canvas 底层，当前 `repeating-conic-gradient(#e5e7eb_0_25%,#f8fafc_0_50%)`）

问题集中在深色主题：页面近黑（`--background: oklch(0.145 0 0)`）、预览区只有 ~0.182 的暗灰，整块编辑区过于发暗。目标是在深色主题下用现有中性 token 提亮这三处；light 主题保持现状不变。

**非目标。**
- 修改全局主题 token（`src/index.css` 的 `:root` / `.dark`）。
- 新增自定义 CSS 变量或一套独立颜色系统。
- 改动 `ImageViewer` 预览弹窗的背景（那是独立组件，本次不碰）。
- 可配置化/用户可调背景。
- 改变任何组件 props、事件、类型、IPC 契约。

## Affected modules and responsibility boundaries

- **`src/components/sag/image-editor/index.vue`** — 唯一核心改动，四处 class：
  - `main`（line 380）：`bg-background` → `bg-muted`。深色 `0.145 → 0.269`，明显变浅；light 主题 `1.0 → 0.97`，几乎无感。header 无独立背景，随 main 继承 muted。
  - 预览区 `section.stageContainer`（line 406）：`bg-muted/30` → `bg-muted`，与页面同为 muted、连成一片；**不加任何 border**（这是相对评审反馈 rev-1 的修订：深色下 `--border` 与 `--muted` 同为 `oklch(0.269 0 0)`，border 类分隔线不可见，无意义）。采纳评审「同色一体」的编辑器惯例——画布矩形本身即视觉锚点，页面与预览区无需分隔线。
  - canvas 棋盘格（line 426）：改为主题感知——**light 主题保持现状** `repeating-conic-gradient(#e5e7eb_0_25%,#f8fafc_0_50%)_50%/16px_16px`，仅深色下提亮为 `dark:bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fafafa_0_50%)_50%/16px_16px]`（zinc-100 / zinc-50）。这是相对评审反馈 rev-1 的修订：原方案把两端都改成 #f4f4f5/#fafafa，在 light 的 `bg-muted`(0.97) 表面上会与工作区融为一体、透明指示器消失；改为仅深色提亮后，light 完全不变，深色下 0.269 表面上 #f4f4f5(L≈0.967) 仍清晰可辨。
  - 设置栏 `ScrollArea`（line 450）：`bg-background` → `bg-muted`，并去掉 `border-l`。这是相对评审反馈 rev-1 的修订：原方案 main 提亮而设置栏留 `bg-background`，深色下形成「主区 0.269 / 设置栏 0.145」两段式；统一为 muted 后整个编辑器是一整块更浅的表面，符合「整体变浅」的意图，也不再需要一个在 muted 上不可见的 border-l 分隔线。
- **`src/views/character-expression-editor/index.vue`** — 一致性微调：加载/错误兜底 `main`（line 59）同样 `bg-background` → `bg-muted`，避免编辑页打开瞬间闪一块深黑。
- 其余（`index.ts` barrel、五个 `ImageViewer` 调用点、IPC/preload/shared）— 不变。

## Key data flow / control flow

无数据流变化。纯展示层 class 调整，不引入状态、事件或逻辑分支。

## Interfaces, storage and compatibility contracts

无类型 / Schema / IPC / 存储变化。`SagImageEditor` 的 `props`（`fileName/mimeType/sourceUrl`）与 `emit('back')` 不变。

## Failure, concurrency, security, migration

- 失败/并发：无新增异步路径，无状态变化。
- 安全：无新信任面。
- 迁移：无持久化。主题色仅影响运行时渲染。

## Verification strategy and acceptance criteria

静态检查（改动范围内）：
- `pnpm build:web` 通过。
- `pnpm exec oxlint src/components/sag/image-editor/index.vue src/views/character-expression-editor/index.vue` 干净。
- `pnpm exec oxfmt --check` 上述两个文件干净。
- `git diff --check` 干净。

行为验收（按 AGENTS.md，视觉验收由用户完成；开发者不主动启 Electron 截屏）：
- 深色主题打开任意表情 → 编辑页（含加载态兜底）整块背景（页面、预览区、设置栏）明显比之前浅，为中性灰而非近黑，页面与预览区同一色面、无分隔线。
- 深色下画布棋盘格比现状更浅、对比更柔和，透明区边界仍清晰可辨。
- light 主题下编辑器与现状几乎完全一致（页面/设置栏 0.97 vs 现状 1.0，棋盘格保持不变）。
- 「重置 / 裁剪 / 变换 / 导出」操作不受影响。

## Task breakdown and dependencies

两个文件、四处 class 的纯样式改动。由 developer 实现。
「完成」= 上述静态检查全部通过 + 改动 diff 只包含这两个文件、不超过五处 class（main、stage、棋盘格、设置栏、兜底 main）；视觉效果由用户在人机界面验收，开发者把 diff 和检查结果贴回。

引用：
- 编辑器主组件：`src/components/sag/image-editor/index.vue:380`（main）、`:406`（stage）、`:426`（棋盘格）、`:450`（设置栏）
- 编辑页入口：`src/views/character-expression-editor/index.vue:50-56`、`:59`
- 主题 token：`src/index.css:124-157`（`.dark`）、`:88-122`（`:root`）
