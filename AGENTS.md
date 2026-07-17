# AGENTS.md

本文件约束所有在本仓库中工作的代码代理。开始修改前先阅读本文件；涉及产品流程或界面重构时，同时阅读 `docs/产品方向-角色共创工作流.md`。

## 产品上下文

- 当前 `README.md` 描述的是旧版“写卡 + 抽卡”产品，不再作为产品方向的唯一依据。
- 新产品围绕“角色共创 -> 定妆 -> 角色表 -> 资产生长”展开。
- 主体验是阶段式、全屏创作流程，不继续扩展旧的常驻 Sidebar 信息架构。
- 面向用户使用“角色档案、定妆、角色表、表情”等创作语言。除高级功能外，不暴露 prompt、md、参考图参数等底层实现概念。
- 用户负责确认角色和选择图片；不要自动替用户挑选最终基准资产。

## 技术栈与边界

- 桌面端：Tauri 2。
- 前端：Vue 3、TypeScript、Pinia、Vue Router、Tailwind CSS 4。
- 后端：Rust；外部 HTTP 请求、API key 和本地文件读写均放在 Tauri/Rust 层。
- 前端通过 Tauri `invoke` 和事件与 Rust 通信，不直接请求 DeepSeek、APIMart 等外部服务。
- 不为局部需求引入新的状态库、CSS 框架或组件库。添加依赖前，先确认现有依赖和组件不能满足需求。

## 组件使用规则

以下两个目录是前端界面的强制组件来源：

- `src/components/ui/`：按钮、输入框、弹窗、菜单、Tabs、表单、Resizable、Tooltip 等通用 UI 原语。
- `src/components/ai-elements/`：对话、消息、Prompt 输入、Reasoning、附件、图片、Artifact 等 AI 交互组件。

实现界面前必须先搜索这两个目录。已有组件能够覆盖的能力，必须直接复用或组合，不得在业务页面中重新实现。

具体要求：

1. 不得用原生 `<button>`、`<input>`、`<textarea>`、自制弹层或临时 CSS，重复实现已有的 `Button`、`Input`、`Textarea`、`Dialog`、`DropdownMenu`、`Tabs`、`Tooltip` 等组件。
2. AI 对话必须优先使用 `Conversation`、`Message`、`PromptInput`、`Reasoning`、`Loader` 等 `ai-elements` 组件，不另写一套聊天气泡和输入框。
3. 需要调整外观时，通过现有组件的 props、variant、slot 和 `class` 组合实现。不要复制组件源码到业务目录后修改。
4. 确实缺少通用能力时，先判断它属于 `ui`、`ai-elements` 还是当前 feature。通用能力补到相应组件目录；业务组合留在 feature 目录。
5. 修改 `src/components/ui/` 或 `src/components/ai-elements/` 前，先检查所有调用方，避免为一个页面破坏共享行为。
6. 图标使用 `lucide-vue-next`。存在对应图标时，不手写 SVG，不用文字按钮代替明确的常见图标操作；不熟悉的图标按钮提供 Tooltip 或可访问名称。
7. 普通的 `<div>`、`<section>`、`<header>`、`<main>` 等语义和布局标签可以直接使用。本规则限制的是重复造交互组件，不是禁止原生 HTML。

### 组件导入

- `src/components/ui/` 已在 `vite.config.ts` 中配置自动注册；模板中按现有代码直接使用 PascalCase 组件即可。
- `src/components/ai-elements/` 从具体目录的 barrel 文件显式导入，例如：

  ```ts
  import { Conversation, ConversationContent } from '@/components/ai-elements/conversation';
  import { Message, MessageContent } from '@/components/ai-elements/message';
  ```

- 不跨层级导入组件内部文件。优先从目录的 `index.ts` 导入；如果缺少导出，补充 barrel export。
- 业务代码使用 `@/` 路径别名，避免深层 `../../../` 相对路径。当前目录内的相邻 feature 组件可以使用 `./components/...`。

## 文件与命名

### Vue 与 TypeScript

- 页面目录使用小写 kebab-case；页面入口固定为 `src/views/<feature>/index.vue`。
- 页面私有组件放在 `src/views/<feature>/components/`，文件名使用 kebab-case，例如 `chat-summary-preview.vue`。
- 应用级共享组件放在 `src/components/`，文件名使用 kebab-case，例如 `context-editor.vue`。
- `src/components/ui/` 与 `src/components/ai-elements/` 遵循其现有生成约定：Vue 组件文件使用 PascalCase，目录使用 kebab-case，并通过 `index.ts` 统一导出。不要为统一外观而批量重命名这些文件。
- 普通 TypeScript 文件使用小写 kebab-case。Pinia store 使用清晰的单数领域名，例如 `chat.ts`、`character.ts`。
- composable 文件使用 `useXxx.ts`，导出的函数使用 `useXxx()`。
- 类型和组件使用 PascalCase；函数、变量、props 和 emits 使用 camelCase；常量仅在真正不可变且跨函数共享时使用 UPPER_SNAKE_CASE。
- 模板中的组件名使用 PascalCase，事件名和 HTML 属性使用 kebab-case。

### Rust

- 模块和文件使用 snake_case。
- 函数和变量使用 snake_case；struct、enum 和 trait 使用 PascalCase；常量使用 UPPER_SNAKE_CASE。
- Tauri command 保持薄层：参数校验和协议适配放在 command，业务逻辑和可测试的纯函数下沉到对应模块。
- 用户可见错误使用简洁中文；底层错误应保留足够上下文，不返回 API key 或完整敏感 payload。

## Vue 代码风格

- 所有 Vue SFC 使用 `<script setup lang="ts">`。
- SFC 默认顺序为 `<script setup>`、`<template>`、必要时 `<style scoped>`。
- 遵循 `eslint.config.mjs`：2 空格缩进、单引号、分号、1TBS 大括号风格。
- TypeScript 保持 `strict`。不要使用 `any` 逃避建模；优先用明确的 interface、type union 和类型收窄。
- props 使用 `defineProps`，事件使用带类型的 `defineEmits`，并显式声明所有 emit。
- 简单派生状态使用 `computed`，可变状态使用 `ref`；不要把可以计算出的值重复存进 store。
- 异步操作必须有 loading、empty、error 和 disabled 状态。付费生图操作必须有明确的人为触发和进行中反馈。
- 页面组件负责流程编排；复杂展示、交互和可复用逻辑下沉到 feature component、store 或 composable。
- 注释解释约束和原因，不复述代码。过时注释与实现一起更新。

## 样式与交互

- 优先使用 Tailwind utility 和现有主题 token，如 `bg-background`、`text-muted-foreground`、`border-border`；不要在业务组件中硬编码一套独立颜色系统。
- 需要条件合并 class 时使用 `@/lib/utils` 中的 `cn`。
- 保持桌面端工作区安静、清晰、以任务为中心。不要把流程页做成营销落地页，也不要堆叠装饰性卡片。
- 不创建卡片套卡片。页面区块默认使用无外框布局；卡片只用于候选图片、重复资产、弹窗或确实需要边界的工具。
- 固定格式元素要有稳定尺寸或比例，例如图片候选使用明确的 `aspect-ratio`，避免加载和 hover 时布局跳动。
- 文本、按钮和工具栏必须在窄窗口下可换行或收缩，不允许互相遮挡。
- 所有点击操作应支持键盘与清晰焦点状态；图片和纯图标按钮提供可访问名称。

## 状态与数据

- Pinia 使用 Composition API 风格 store，与现有 `defineStore(..., () => {})` 保持一致。
- 角色档案、定妆照、角色表和衍生资产是领域对象；不要让页面组件直接依赖散落的文件名约定。
- 对话历史不是角色档案。只有用户确认后的结构化档案才是后续生成的长期上下文。
- 修改角色基准或角色档案时，要明确处理其对后续资产的影响，不静默覆盖已有资产。
- 生成结果是资产。默认追加，不覆盖；设为基准必须由用户明确确认。

## 变更纪律

- 修改前先读取相关页面、store、类型、Tauri command 和共享组件，不根据文件名猜测行为。
- 保持改动聚焦。不要顺手重构无关模块，不覆盖或回退工作区中已有的用户修改。
- 不手工编辑生成文件，如 `src/types/auto-import.d.ts` 和 `src/types/auto-import-components.d.ts`；需要时运行对应生成流程。
- 删除旧页面或旧组件前，先用 `rg` 确认路由、菜单、store、类型和 Rust command 的引用。
- 不用真实付费生图请求做验证；使用已有 dry-run 路径。真实抽卡由用户触发。

## 验证

根据改动范围执行最小且充分的验证：

```bash
# Vue / TypeScript 构建
pnpm build

# 只检查改动过的前端文件；不要为了一个局部改动 lint --fix 全仓库
pnpm exec eslint <changed-files>

# 修改 Rust 后
cd src-tauri && cargo test
```

交付前同时运行 `git diff --check`，并确认生成文件、缓存和无关格式化没有混入 diff。
