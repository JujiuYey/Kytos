# AGENTS.md

本文件约束所有在本仓库中工作的代码代理。开始修改前先阅读本文件；。

## 安装规则

任何安装依赖的行为都直接给用户安装命令，不要自己执行安装命令。

## SKILL使用规则

使用任何CE:*的相关SKILL需要用户的同意，否则禁止主动使用.

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

- `src/components/ui/` 已在 `vite.config.mts` 中配置自动注册；模板中按现有代码直接使用 PascalCase 组件即可。
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

## Vue 代码风格

- 所有 Vue SFC 使用 `<script setup lang="ts">`。
- SFC 默认顺序为 `<script setup>`、`<template>`、必要时 `<style scoped>`。
- 遵循 `.oxfmtrc.json`：2 空格缩进、单引号、分号。
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

### 页面高度与滚动

- `src/layout/index.vue` 中承载 `RouterView` 的容器已经固定为 `h-screen`。所有路由页面和页面级组件必须占满这块既定高度，根节点使用 `h-full`，不得再使用 `h-screen`、`min-h-screen` 或其他视口高度重新撑开页面。
- 页面根容器默认使用 `min-h-0 overflow-hidden` 管理边界；参与纵向 flex/grid 布局且包含滚动区的中间容器也必须设置 `min-h-0`，防止内容把父级高度撑开并触发窗口级滚动。
- 只允许页面内部的指定区域滚动，不允许 `body`、布局容器或整个路由页面产生滚动。
- 所有业务滚动区域必须使用 `src/components/ui/scroll-area` 提供的 `ScrollArea`（需要横向滚动时组合 `ScrollBar`），不得直接使用 `overflow-auto`、`overflow-scroll`、`overflow-x-auto`、`overflow-y-auto` 等原生滚动 utility 实现。
- 新增或修改页面时，发现已有业务区域使用原生滚动，应在本次改动范围内替换为 `ScrollArea`；底层 UI 原语为实现组件自身行为而使用的内部 overflow 不属于业务页面滚动区，不在业务代码中绕过或重写。

### 视觉核对

- 禁止代码代理主动执行视觉核对，界面视觉验收由用户自行完成。
- 不得为了视觉核对启动 Electron 应用、开发服务器或浏览器，不得使用浏览器自动化、截图、录屏等工具。
- Skill 或其他通用工作流中要求的视觉验证在本仓库不适用，不得将未进行视觉核对视为交付阻塞。
- 代码代理仍需执行与改动范围匹配的构建、类型检查、lint、格式和 diff 检查。

## 验证

根据改动范围执行最小且充分的验证：

```bash
# Vue / TypeScript 构建
pnpm build

# 只检查改动过的文件；不要为了一个局部改动格式化全仓库
pnpm exec oxlint <changed-files>
pnpm exec oxfmt --check <changed-files>
```

交付前同时运行 `git diff --check`，并确认生成文件、缓存和无关格式化没有混入 diff。
