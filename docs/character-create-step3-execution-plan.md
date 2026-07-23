# 角色创建第三步改造 · 执行计划（交付 Codex）

> 本文件是可直接执行的实现计划，自洽、无需依赖其他文档。
> 若与 `docs/character-create-step3-redesign.md`（设计稿）冲突，**以本文件为准**。
> 代码库：Electron（Electron Forge + Vite）+ Vue 3（`<script setup lang="ts">`）+ Tailwind v4 + AI SDK。

---

## 0. 目标与边界（先读，避免跑偏）

**目标**：把「角色创建」第三步从「多轮聊天访谈填 21 字段」改成「点选大方向 → AI 生成候选整图 → 用户选一张 → 图生图精修成最终形象」，降低用户使用成本，保证输出是一张风格自洽的完整动漫图。

**明确不要做（硬边界）**：
- ❌ 不引入任何 3D / 建模 / Live2D。全程 2D。
- ❌ 不做 SVG 渲染、不做 PNG 图层合成、不做部件拼装（避免「缝合怪」）。输出永远是一张完整整图。
- ❌ 不做「选完基底后一项项换发型」的局部微调循环（旧设计稿里的所谓「3d」环节已废弃，不实现）。
- ❌ 不使用 `seed`、不使用 `strength`/denoising —— 目标生图 API（apimart GPT-Image-2）**不支持这两个参数**，不要臆造。
- ⚠️ `src/views/character-customize` 已被删除。如需其中的选项面板 UI，从 **git 历史**里捞（曾有 `appearance-control-panel.vue`），或直接重建；不要 import 它。

**本次要改的现有文件（已确认存在）**：
- 后端 Agent：`electron/character-create-agent/instructions.ts`、`agent.ts`、`route.ts`
- 共享类型：`shared/character-create.ts`
- 生图服务：`electron/services/character-portrait.ts`（apimart 调用所在，需 Codex 打开确认具体函数）
- 前端：`src/views/character-create/index.vue`、`workflow-data.ts`、`components/*`

---

## 1. 目标流程（改造后）

```
第一步 选风格（保留，不动）           StyleId + stylePrompt
第二步 参考图（保留，可选，不动）      referenceImage
第三步 引导选择 + 生成候选 + 选基底（重做）
        3-① 点选面板：填「核心字段」（见 §2），可选一句话补充
        3-② 生成候选：一次请求 n=4 张文生图（1k），并行展示
        3-③ 选基底：用户点选 1 张 → 记为 baseImage
第四步 精修定稿（重做）
        用 baseImage 走图生图（image_urls）精修 → 2k 官方视觉 → 保存
```

> **⚠️ 待确认假设（第四步的作用）**：本计划假设「第四步 = 把第三步选中的候选图，用图生图精修成高清定稿（提分辨率到 2k、强化单人/全身/纯白底、清理杂物）」。
> 如果产品意图不是「精修」而是别的（例如与参考图融合），请在实现第四步前与需求方确认，仅需改动 §5 的第四步部分，其余不受影响。
> **降级选项**：若实测发现「直接把第三步选中的候选图当最终图」已足够好，第四步可退化为「不再生图，直接保存选中候选」——保留开关，别写死。

---

## 2. 数据模型：核心字段 vs 次要字段

**不要改 `shared/character-create.ts` 里 `CharacterCreateDraft` 的 21 个字段类型**（保持向后兼容），只在逻辑层区分层级。

**核心字段（进 3-① 点选面板，驱动候选生成）**：
`gender`、`age`、`hairstyle`、`hairColor`、`clothingStyle`、`bottomsStyle`、`characterMood`、`primaryColor`、`overallStyleKeywords`（最后一个为可选自由输入）。

**次要字段（本期不进面板，生成时给合理默认或留空）**：
`bottomsLength`、`bottomsColor`、`clothingColor`、`clothingLength`、`shoesStyle`、`shoesColor`、`shoesHeight`、`secondaryColor`、`accentColor`、`backgroundColor`、`accessories`、`props`、`forbiddenColors`。

实现：在 `workflow-data.ts` 导出一个常量区分两层，例如：
```ts
export const CORE_DRAFT_FIELDS = ['gender','age','hairstyle','hairColor','clothingStyle','bottomsStyle','characterMood','primaryColor','overallStyleKeywords'] as const;
```
并为核心字段提供点选预设数据（每个字段一组可选项：label + value；发型/发色/主色建议带缩略图或色块）。

---

## 3. 目标生图 API 事实（apimart GPT-Image-2，实现时严格照此）

- 端点：`POST https://api.apimart.ai/v1/images/generations`，异步：返回 `task_id`，再 `GET /v1/tasks/{task_id}` 轮询到 `status=completed`。
- 取图：`data.result.images[0].url[0]`。结果 URL 带 `expires_at`（会过期）。
- **文生图**：传 `prompt`（+ `size` + `resolution` + `n`）。
- **图生图**：在上述基础上加 `image_urls: string[]`（参考图，最多 16 张，支持公网 URL 或 `data:image/...;base64,` ）。传了就进图生图模式。
- 关键参数：
  - `n`：1–10，**一次请求可出多张**（第三步候选用 `n:4`，一次搞定，别发 4 次）。
  - `size`：比例，如 `3:4`（竖图，适合人物全身）。
  - `resolution`：`1k` / `2k` / `4k`。第三步候选用 `1k`（快、省），第四步定稿用 `2k`。
  - **无 `seed`、无 `strength`** —— 不要传。
- 无 strength 旋钮 → 「只改动/尽量保真」只能靠 **prompt 措辞** 约束。
- 参考图过期风险 → 第四步用第三步候选图做 `image_urls` 时，**优先把候选图落地本地再转 base64 传入**，不要依赖可能已过期的临时 URL（除非确认 URL 有效期足够）。

---

## 4. 后端改造（`electron/character-create-agent` + 生图服务）

### 4.1 重写 `instructions.ts`

Agent 角色从「盘问者」改为「把结构化选择翻译成高质量生图 prompt 的翻译器 + 合理默认提案者」。新指令要点：

1. 核心字段已由 UI 点选提供，**不要逐轮追问**；仅在信息自相矛盾时确认一次。
2. **允许并鼓励**对用户未指定的次要字段给出合理默认（如未选鞋子就配百搭款），在 prompt 中作为默认处理即可。
3. 产出最终 prompt 时**必须套用固定模板结构**（见 4.2），不要自由撰写整段。
4. **负面项独立**：禁止物品/场景/文字/水印/第二人等，输出到 prompt 的独立负面段，不与正文混写。
5. 保留原有正确约束：单一人物、全身、纯白背景、人设优先于画风、用户指定色优先于风格默认色；参考图仅用于身份/脸型/发型/体态，不照搬背景道具。
6. 只输出简洁中文，不输出思维过程，不声称图已生成。

### 4.2 `finalizeCharacterPrompt` 改为结构化组装

`agent.ts` 中 `finalizeCharacterPrompt` 工具：不再接收模型自由撰写的一整段 `prompt`，改为按模板从 draft 组装。最终 prompt 结构（正文 + 负面分离）：

**正文模板**（中英名词并存，具体措辞可按实测微调）：
```
one single {gender}, {age}, full body, centered,
{hairstyle}, {hairColor} hair,
{clothingStyle} top, {bottomsStyle} bottoms,
{characterMood},
main color {primaryColor},
{overallStyleKeywords},
{stylePrompt},   // 来自第一步，仅约束画法
pure white background, no shadow, character design sheet
```
**负面段**（供 prompt 末尾统一声明，或未来接入负面字段）：
```
no props, no scene, no background decoration, no text, no logo,
no watermark, no second person{, forbiddenColors 若有}
```

> 若保留 `finalizeCharacterPrompt` 的入参 `prompt` 字段，则让 Agent 按上述模板产出、后端再做一次结构校验；不允许出现空模板槽位以外的自由发挥。

### 4.3 简化对话为「单次组装」（推荐）

当前用 `useChat` 多轮流式。改造后第三步核心信息来自点选面板，Agent 只需**一次调用**把 draft（+ 可选自由文本 + stylePrompt）翻译成最终 prompt。
- 保留 `ToolLoopAgent` / 端点骨架；把交互从「多轮聊天」收敛为「提交 draft → 一次生成最终 prompt」。
- 可保留一个可选的「一句话补充」输入框，但不强制多轮对话。

### 4.4 生图服务支持图生图

在 `shared/character-create.ts`：给 `GenerateCharacterVisualRequest` 增加可选字段：
```ts
imageUrls?: string[];   // 图生图参考图（URL 或 base64 data URI），映射到 apimart image_urls
size?: string;          // 如 '3:4'
resolution?: '1k' | '2k' | '4k';
n?: number;             // 候选数量
```
在 `electron/services/character-portrait.ts`（或实际发起 apimart 请求的函数）：
- 把上述字段透传进请求体；`imageUrls` 存在时即图生图模式。
- **不要**加 `seed` / `strength`。
- 保持现有异步提交 + 轮询逻辑不变。

---

## 5. 前端改造（`src/views/character-create`）

### 第三步（重做 `components/character-prompt-step.vue` 或新增组件）
- **3-① 点选面板**：按 §2 核心字段渲染点选控件（tab/按钮/色块）。可从 git 历史恢复 `appearance-control-panel.vue` 的 UI 骨架，或重建。每次点选写入本地 draft。底部一个可选「一句话补充」输入。
- **「生成候选」按钮**：调用 §4.3 得到最终 prompt → 调 `generateCharacterVisual`，传 `n:4, size:'3:4', resolution:'1k'`（文生图，不带 imageUrls）→ 复用现有每 2.5s 轮询逻辑，展示 4 张骨架占位 + 结果。
- **3-③ 选基底**：4 张候选网格，用户点选 1 张记为 `baseImage`（保存其图数据/URL），进入第四步。

### 第四步（重做 `components/character-generation-step.vue`）
- 用 §1 假设：拿 `baseImage` 做图生图精修。
  - 先把 `baseImage` 落地/转 base64（见 §3 过期风险）。
  - 调 `generateCharacterVisual`，传 `imageUrls:[base64], size:选定比例, resolution:'2k'`，prompt 复述「同一角色、保持脸型与画风、单人全身纯白底、精修高清」。
- 展示定稿结果，提供「重生成」「保存为角色官方视觉」（复用现有 `saveCharacterVisual`）。
- 实现 §1 的**降级开关**：可配置「跳过第四步图生图，直接保存选中候选」。

### `index.vue`（状态机）
- Step 定义保持 1–4，但第三步内部新增子状态：`selecting`（点选）→ `generating`（出候选）→ `picking`（选基底）。
- 把「生成」动作从原第四步一次性调用，拆成：第三步的候选生成（文生图）与第四步的定稿生成（图生图）两类调用。
- 移除以聊天为中心的流程分支；保留轮询、保存、错误提示。

### `workflow-data.ts`
- 导出 `CORE_DRAFT_FIELDS` 及核心字段的点选预设数据（发型/发色/服装/气质/主色的可选项）。
- 保留 `CHARACTER_STYLES`、`StyleId`、`stylePrompt` 不动（第一步继续用）。

---

## 6. 分期与验收

### 第一期（最小可用，先交付）
- [ ] 后端：`instructions.ts` 重写为翻译器 + 模板化 finalize（§4.1/4.2/4.3）。
- [ ] 后端：`GenerateCharacterVisualRequest` 与生图服务支持 `imageUrls/size/resolution/n`（§4.4）。
- [ ] 前端第三步：点选面板 + `n:4` 文生图候选 + 选基底（§5 第三步）。
- [ ] 前端第四步：`baseImage` 图生图精修 2k + 保存（§5 第四步），含降级开关。
- **验收**：用户全程不打字（仅点选 + 可选一句补充），即可得到 4 张候选、选 1 张、拿到一张 2k 定稿并保存为角色视觉；生成的图为单人全身纯白底、无多余杂物；换风格/字段重新生成时输出稳定为完整整图。

### 第二期（可选增强，先不做）
- 参考图（第二步）在图生图里作为身份增强一并传入 `image_urls`。
- 候选生成的渐进展示（先出 1 张再补 3 张）以缓解 ~52s 延迟。
- 结果版本管理与回退。

---

## 7. 风险与注意事项

1. **延迟**：apimart 单次生成示例 `actual_time ≈ 52s`。第三步一次 `n:4` 也要等，UI 必须有明确进度/骨架占位，避免用户以为卡死。不要做「每点一下就生图」。
2. **参考图过期**：图生图用的基底图优先 base64 落地传入，别用可能过期的临时 URL。
3. **无 strength**：「精修但别把人改样」只能靠 prompt 反复强调保留项；实测若漂移过大，把发色/脸型等关键特征复述进 prompt 当锚。
4. **DeepSeek 看不到图**：当前访谈脑是文本模型，无法真正「看」参考图。本期不依赖它读图；未来若要真正利用参考图理解，需换视觉模型（不在本期范围）。
5. **git 历史依赖**：`character-customize` 已删，恢复其面板 UI 需从历史 checkout，不要新建对它的 import。

---

## 8. 一句话交付说明

把第三步从「聊天填 21 字段」改成「点选 9 个核心字段 → 一次生 4 张候选整图 → 选 1 张 → 图生图精修成 2k 定稿保存」；后端 Agent 降级为「模板化 prompt 翻译器」，生图服务打通 apimart `image_urls` 图生图（无 seed / 无 strength）。
