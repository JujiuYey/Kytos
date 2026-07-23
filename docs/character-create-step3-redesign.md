# 角色创建第三步重设计方案

> 状态：设计草案 · 作用范围：`src/views/character-create` 第三步（人设确认）+ `electron/character-create-agent/*`
> 目标：把「聊天访谈填 21 个字段」改成「引导选择 + 生成基底 + 局部图生图」，在**不增加用户描述负担**的前提下，让普通用户拿到一个好看、可微调、且前后一致的动漫形象。

---

## 1. 背景与问题定位

现状第三步是一个访谈式 Agent（`electron/character-create-agent/instructions.ts` + `agent.ts`），通过多轮对话把用户描述写入一份 21 字段的 `CharacterCreateDraft`，最后 `finalizeCharacterPrompt` 输出一段自由撰写的中文提示词交给 GPT-Image-2 生图。

代码实现本身是干净的（`ToolLoopAgent` + zod schema + 工具分明），但存在四个结构性问题：

1. **范式错误——访谈成本高。** `instructions.ts` 规则 1「每次只追问一个信息」× 21 个字段 = 十几轮对话。这正是「用户要会描述才行」的高门槛。
2. **创意负担全在用户。** 规则 2「只有用户明确说出才能写入草稿」使 Agent 不敢主动提方案，普通用户被迫自己憋出全部审美。
3. **提示词工程薄弱。** 最终 prompt 由模型自由撰写，无模板、无 few-shot；禁用项以散文形式塞进正文，生图模型对否定句识别不稳；`finalizeCharacterPrompt` 只校验长度，不从 draft 结构化拼装，导致右侧 draft 面板与最终 prompt 无强绑定。
4. **无视觉反馈闭环。** 聊 → 聊 → 最后生一次图，错了回去继续聊，是成本最高的循环。且 DeepSeek 是纯文本模型，看不到参考图。

**核心结论：不要去把访谈 Agent 调得更聪明，而要改交互范式——让用户「看图选」而不是「打字描述」。**

---



## 2. 设计目标

- **用户成本最低**：能不打字就不打字，用点选 + 看图选代替描述。
- **画质到动漫**：输出永远是一张风格自洽的完整图，不做部件合成（避免「缝合怪」）。
- **前后一致**：换发型/换装时同一个角色的脸和画风不变。
- **延迟可忍**：把生图集中在 1~2 个关键节点，不每步都生。
- **复用现有骨架**：保留 `ToolLoopAgent`、Electron 端点、生图服务与轮询逻辑，主要改交互层与提示词层。

---



## 3. 新流程总览

```
第一步 选风格（保留）
第二步 上传参考图（保留，可选）
第三步（重做）：引导选择 → 生成基底 → 选基底 → 局部微调
   3a 引导选择   用点选面板收集「大方向」（精简字段），可选一句话补充
   3b 生成基底   一次性并行生成 3~4 张完整角色图
   3c 选基底     用户挑一张最顺眼的 → 成为该角色的「身份锚」
   3d 局部微调   基于选中的基底做 img2img，只改单点（发型/发色/服装…），脸与画风不变
第四步 定稿保存（保留）
```

关键理念：

- **3c 选中的基底图 = 身份锚**。后续所有微调都以它为 img2img 的输入，从而锁住脸型与画风。
- **img2img 不是收尾一次，而是贯穿 3d 的一致性机制**。

---



## 4. 数据模型调整：精简 draft 字段

现有 21 字段里，很多对「第一眼好看」几乎无贡献，却成倍拉长交互。分两层：

### 核心字段（影响第一眼观感，进 3a 引导面板）


| 字段                     | 说明              | 采集方式        |
| ---------------------- | --------------- | ----------- |
| `gender`               | 性别              | 点选          |
| `age`                  | 年龄段（少年/青年/成人…）  | 点选          |
| `hairstyle`            | 发型              | 点选（预设款式缩略图） |
| `hairColor`            | 发色              | 点选色板        |
| `clothingStyle`        | 上装风格            | 点选          |
| `bottomsStyle`         | 下装风格            | 点选          |
| `characterMood`        | 整体气质（冷艳/元气/温柔…） | 点选          |
| `primaryColor`         | 主色调             | 点选色板        |
| `overallStyleKeywords` | 自由补充（可留空）       | 一句话输入       |




### 次要字段（不进引导，改由 3d 局部微调按需触发）

`bottomsLength`、`bottomsColor`、`clothingColor`、`clothingLength`、`shoesStyle`、`shoesColor`、`shoesHeight`、`secondaryColor`、`accentColor`、`backgroundColor`、`accessories`、`props`、`forbiddenColors`。

> 落地建议：不改 `CharacterCreateDraft` 的类型（保持向后兼容），只在 UI 层区分「核心/次要」。核心字段驱动 3a 与 3b 的基底生成；次要字段默认留空或给合理默认值，用户想改时在 3d 触发。

---



## 5. Agent 角色重定义

从「盘问者」变成「把结构化选择翻译成高质量生图 prompt 的翻译器 + 主动提案者」。

### instructions 要点变化


| 旧规则            | 问题       | 新规则                                         |
| -------------- | -------- | ------------------------------------------- |
| 每次只追问一个缺失信息    | 对话冗长     | 不追问；核心字段已由 UI 点选提供，Agent 只在信息矛盾时确认一次        |
| 只有用户明说才写入草稿    | 创意负担全在用户 | **允许并鼓励对未填字段给出合理默认提案**，在 prompt 中标注为「默认，可调」 |
| 最终 prompt 自由撰写 | 质量飘      | **必须套用固定模板结构填空**（见 §6）                      |
| 禁用项写进正文散文      | 否定句识别不稳  | 负面项输出到**独立字段/负面 prompt**，不混入正文              |




### 工具调整

- `updateCharacterDraft`：保留，但主要由 3a 的点选批量写入，而非逐轮对话。
- `finalizeCharacterPrompt`：**改为按模板从 draft 结构化组装**，`prompt` 字段拆成结构化片段而非一整段自由文本（见 §6）。
- 新增（可选）`proposeVariants`：给定当前 draft，产出 3~4 组「有差异的基底方向」的 prompt，用于 3b 一次性并行生成。差异应集中在少数维度（如发型/气质），其余保持一致，方便用户对比。

---



## 6. 提示词模板（交给 GPT-Image-2）

用固定结构填空，杜绝自由发挵。正文与负面分离。

**正文模板（建议英文 + 关键中文名词并存，具体以实测为准）：**

```
[主体] one single {gender}, {age}, full body, centered
[五官/发型] {hairstyle}, {hairColor} hair
[服装] {clothingStyle} top, {bottomsStyle} bottoms{, 次要字段按需追加}
[气质] {characterMood}
[配色] main color {primaryColor}{, 次要配色按需}
[画风] {stylePrompt}   ← 来自第一步选的风格，仅约束画法
[构图] pure white background, no shadow, character design sheetcharacter-customize
```

**负面（走模型 negative 参数或独立字段，禁止塞进正文）：**

```
no props, no scene, no background decoration, no text, no logo,
no watermark, no second person, {forbiddenColors}
```

约束（沿用旧规则 5/6/7 的正确意图）：

- 单一人物、全身、纯白背景。
- 人设优先于画风；用户指定颜色优先于风格默认色。
- 参考图仅用于身份/脸型/发型/体态，不照搬背景与道具。

---



## 7. 一致性机制（已按 GPT-Image-2 / apimart 实际接口修正）

目标：3d 换发型时，脸和画风不变 = 同一个角色。

**API 现实（apimart** `POST /v1/images/generations`**）：**

- 图生图通过 `image_urls` 数组实现（最多 16 张参考图，URL 或 base64）。传入即进入图生图模式。
- **没有 seed 参数** —— GPT-Image-2 属于 OpenAI 系模型，不对外暴露 seed。因此「seed 锁定」方案作废，不用考虑。
- **没有** `strength` **/ denoising 强度参数** —— 无法用旋钮控制「改多少」，改动幅度只能靠 prompt 措辞引导。
- 不传 `size` 时输出分辨率 = 输入图分辨率；传 `size` 则强制按指定尺寸出图。

**因此一致性完全依赖参考图这一条路（够用）：**

- **换发型/换装 = 把 3c 选中的基底图放进** `image_urls`，prompt 写明「同一角色，保持脸型与画风不变，只改 XXX」。GPT-Image-2 对参考图中的人脸与画风保持能力较强，靠这个即可实现「换发型脸不变」。
- 示例：
  ```json
  {
    "model": "gpt-image-2",
    "prompt": "同一个角色，保持脸型和画风不变，只把发型换成双马尾",
    "image_urls": ["<3c 选中的基底图 URL>"],
    "size": "3:4",
    "resolution": "1k"
  }
  ```
- 因无 strength 旋钮，**「小改动」靠 prompt 约束**（明确「其余不动」）；若模型改动过大，可在 prompt 里进一步强调保留项，或把关键特征（发色、脸型）也复述进 prompt 作为锚。

> seed 概念补充（备查）：生图从一张随机噪点开始一步步去噪成图，seed 决定那张初始噪点；同 seed + 同 prompt → 同结果。本 API 不支持 seed，故此处不用。

---



## 8. 延迟控制

你反馈延迟高，因此**不能每步都生图**。策略：

- **只在两个节点生图**：3b（生 3~4 张基底，并行）、3d（用户主动点「应用微调」时才生 1 张）。3a 全程零生图（纯点选）。
- **3b 并行发起**，前端展示占位骨架 + 进度轮询（复用现有 `getCharacterVisualGeneration` 每 2.5s 轮询）。
- **缓存基底与每次微调结果**，允许用户回退到任意一版，避免重复生成。
- **克制候选数量**：基底 3~4 张封顶；微调每次 1 张。

---



## 9. 前端改动清单（`src/views/character-create`）

- `components/character-prompt-step.vue`：由「聊天为主」改为「点选面板为主 + 可选一句话补充」。复用被废弃的 `character-customize` 里那套好看的 tab/按钮选项面板 UI（只搬 UI，不搬 SVG 渲染）。
- 新增 `character-base-select-step`（3c）：网格展示 3~4 张基底候选 + 选中态。
- 新增 `character-refine-panel`（3d）：单维度微调控件（发型/发色/服装…）+「应用」按钮触发 img2img。
- `index.vue`：调整 step 状态机，把「生成」从第四步的一次性动作拆成 3b（基底）与 3d（微调）两类调用；保留轮询与保存逻辑。
- `workflow-data.ts`：标注核心/次要字段分层；3a 点选项的预设数据（发型缩略图、色板、气质词）。



## 10. 后端改动清单（`electron/character-create-agent`、生图服务）

- `instructions.ts`：按 §5 重写规则（不追问、允许提案、强制模板、负面分离）。
- `agent.ts`：`finalizeCharacterPrompt` 改为结构化组装；可选新增 `proposeVariants` 工具。
- 生图服务（`electron/services/character-portrait.ts` 等）：打通**图生图入参**——`GenerateCharacterVisualRequest` 增加可选 `imageUrls`（或 `baseImage`，最终映射到 apimart 的 `image_urls` 数组）。**不需要** `seed` / `strength` 字段（本 API 不支持）。基底图需先有公网可访问 URL 或转成 base64 data URI 塞进 `image_urls`。

---



## 11. 待验证的前提（动手前先确认）

> 更新：GPT-Image-2 / apimart 接口已查明——图生图走 `image_urls`，**无 seed、无 strength**。以下为剩余待验证项。

1. **基底图如何喂给** `image_urls`：生成结果返回的是带过期时间的临时 URL（`expires_at`）。需确认：微调时是直接复用该临时 URL，还是要先把基底图下载/落地成本地文件再转 base64 传入（临时 URL 可能已过期）。**建议落地本地并转 base64**，最稳。
2. **改动幅度可控性实测**：因无 strength 旋钮，需实测「只改发型、脸不变」靠 prompt 约束能否稳定达成；不行则把关键特征复述进 prompt 当锚。
3. **延迟实测**：`n` 最大 10，可一次请求出多张。实测 3b「一次 `n:4`」的真实耗时（示例响应 `actual_time` 约 52s），决定候选数量与是否渐进展示。

---



## 12. 分期落地建议

- **第一期（最小可用）**：3a 点选面板 + 3b 生 3~4 张基底 + 3c 选基底 + 模板化 finalize。先干掉「访谈」这个最大成本，暂不做 3d。
- **第二期**：加 3d 局部图生图微调 + 一致性（靠 `image_urls` 传基底图，无 seed）。
- **第三期**：次要字段的精细微调、参考图增强、结果版本管理与回退。

---



## 附：一句话总结

**问题不是 Agent 不够聪明，而是「用聊天填 21 个字段」这个范式错了。** 改成「点选大方向 → 生成整图选基底 → 基于基底做 img2img 局部微调」，用捏脸的交互拿到 AI 生图的画质，同时用 img2img 锁住角色一致性、把生图集中在少数节点控制延迟。