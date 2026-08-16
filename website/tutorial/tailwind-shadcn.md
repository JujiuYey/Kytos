---
title: Tailwind CSS 与 shadcn-vue 完整教程
description: 从 utility CSS 到主题 token、响应式布局、无障碍交互和 shadcn-vue 组件组合。
---

# Tailwind CSS 与 shadcn-vue 完整教程

Tailwind CSS 提供可组合的 utility class，shadcn-vue 提供可直接放入项目、可继续组合的 Vue 组件源码。它们不是两套互相竞争的样式方案：Tailwind 处理布局与视觉，组件原语处理状态、键盘、焦点和 ARIA 语义。

## 1. 安装 Tailwind CSS 4

在 Vite 项目中：

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
});
```

```css
/* src/style.css */
@import 'tailwindcss';
```

```ts
// src/main.ts
import './style.css';
```

## 2. utility-first 思维

```vue
<template>
  <article class="border-border bg-background rounded-md border p-4 shadow-sm">
    <h2 class="text-foreground text-base font-semibold">笔记标题</h2>
    <p class="text-muted-foreground mt-1 text-sm">最后更新于 10:30</p>
  </article>
</template>
```

每个 class 只做一件事。组合后，样式与结构在同一处可见，不需要为每个小区块发明 CSS 类名。

这不意味着可以无限复制长 class 串。当一组样式表达可复用交互语义时，应该封装成组件或 variant。

## 3. 布局

### Flex

```html
<header class="flex min-w-0 items-center gap-3">
  <div class="min-w-0 flex-1">...</div>
  <div class="shrink-0">...</div>
</header>
```

`min-w-0` 让可伸缩子项真正允许内容收缩，`shrink-0` 保护尺寸稳定的操作区。这是解决工具栏文本和按钮互相遮挡的关键。

### Grid

```html
<section class="grid min-h-0 grid-cols-[16rem_minmax(0,1fr)]">
  <aside>...</aside>
  <main class="min-w-0">...</main>
</section>
```

`minmax(0, 1fr)` 避免内容按最小宽度把网格撑出父容器。布局稳定性优先于视觉修饰。

### 响应式

```html
<section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">...</section>
```

Tailwind 默认移动优先：无前缀是最小屏幕，`md:`、`xl:` 在更大断点覆盖。先确保内容在窄宽度可用，再增加多栏。

## 4. 主题 token

不要在业务组件里到处写 `bg-zinc-950` 和 `text-gray-400`。用语义 token 表示意图：

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.18 0 0);
  --muted: oklch(0.96 0 0);
  --muted-foreground: oklch(0.48 0 0);
  --border: oklch(0.9 0 0);
  --destructive: oklch(0.58 0.22 27);
}

.dark {
  --background: oklch(0.16 0 0);
  --foreground: oklch(0.96 0 0);
  --muted: oklch(0.23 0 0);
  --muted-foreground: oklch(0.7 0 0);
  --border: oklch(1 0 0 / 12%);
}
```

业务组件使用 `bg-background`、`text-foreground`、`text-muted-foreground`、`border-border`。换主题时只改 token，不遍历页面修改颜色。

## 5. 条件 class

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```vue
<button
  :class="
    cn(
      'rounded-md px-3 py-2 text-sm',
      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
    )
  "
>
  选项
</button>
```

`clsx` 处理条件，`tailwind-merge` 处理 `px-2` 和 `px-4` 这类冲突 utility。

## 6. shadcn-vue 是什么

shadcn-vue 不是一个只能通过 npm 黑盒调用的组件库。CLI 把组件源码放入你的项目，常见结构是：

```text
src/components/ui/
├── button/
│   ├── Button.vue
│   └── index.ts
├── dialog/
└── input/
```

这些组件组合了：

- 可访问性原语，如 Dialog 的焦点限制、Esc 关闭和 ARIA 关系。
- 主题 token 和 Tailwind class。
- 稳定的 props、events 和 slot 组合方式。

业务页应优先组合这些原语，不要再用原生元素重新实现同一套交互。

## 7. 组合 Dialog

```vue
<script setup lang="ts">
import { ref } from 'vue';

const open = ref(false);
const title = ref('');

function submit() {
  if (!title.value.trim()) return;
  // 保存数据
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>新建笔记</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>新建笔记</DialogTitle>
        <DialogDescription>输入一个便于识别的标题。</DialogDescription>
      </DialogHeader>

      <Label for="note-title">标题</Label>
      <Input id="note-title" v-model="title" />

      <DialogFooter>
        <Button variant="outline" @click="open = false">取消</Button>
        <Button :disabled="!title.trim()" @click="submit">创建</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

`DialogTrigger as-child` 把交互能力交给内部 `Button`，避免产生 button 嵌套 button 的非法 HTML。

## 8. variant 而不是复制组件

一个 Button 可以有 `default`、`outline`、`ghost`、`destructive`、`icon` 等 variant。当差异只是视觉和尺寸，扩展 variant；当语义、交互流程和数据边界都改变时，才创建新业务组件。

```ts
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        outline: 'border-border border bg-background',
        destructive: 'bg-destructive text-white',
      },
      size: {
        default: 'h-9 px-4',
        icon: 'size-9',
      },
    },
  },
);
```

## 9. 可访问性是组件行为

一个可用的交互组件必须同时处理：

- 键盘：Tab 顺序、Enter/Space 激活、Esc 退出。
- 焦点：打开后去哪，关闭后回哪。
- 语义：标题、描述和控件之间的关联。
- 禁用：真正阻止操作，而不是只把颜色变灰。
- 纯图标按钮：提供 `aria-label` 或可见 Tooltip。

这些都是 Dialog、DropdownMenu、Tabs、Tooltip 原语存在的理由。一个自制 `div` + click 往往只实现了鼠标用户看到的表面。

## 10. 滚动和稳定尺寸

工作台布局常见结构：

```html
<main class="flex h-full min-h-0 flex-col overflow-hidden">
  <header class="shrink-0">...</header>
  <section class="min-h-0 flex-1">...</section>
</main>
```

滚动应当由明确的内容区域承担，不要让 body、layout 和页面内容同时滚动。图片、棋盘、工具栏和网格项使用稳定尺寸或 `aspect-ratio`，避免加载、hover 和状态文本导致布局跳动。

## 11. 进阶：组件层级

```text
UI primitive       Button / Dialog / Input / Tabs
        ↓
feature component  NoteEditor / SearchToolbar / DeleteNoteDialog
        ↓
page               路由数据 + 业务流程编排
```

- UI primitive 不知道业务名词。
- feature component 组合原语，实现一块完整交互。
- page 拥有导航和流程，不重复实现基础控件。

这个层级能防止两个极端：每页都自己造一遍按钮，或为了“通用”把业务逻辑塞进基础 UI 组件。

## 12. 常见错误

| 错误                     | 改法                                     |
| ------------------------ | ---------------------------------------- |
| 业务页硬编码整套颜色     | 使用语义主题 token                       |
| 用 `div @click` 做按钮   | 使用 Button，保留键盘和焦点行为          |
| 自制弹层只做定位         | 组合 Dialog/Popover/DropdownMenu 原语    |
| 为一次性样式修改共享原语 | 先用 class、slot 和 variant              |
| 无限抽取 CSS 类          | 只在存在可复用语义时抽组件/variant       |
| 卡片套卡片               | 页面区块使用无外框布局，卡片留给重复实体 |

## 13. 练习

为笔记应用建立界面系统：

1. 使用语义 token 支持深浅主题。
2. 使用 Grid 实现侧边列表 + 主编辑区，窄窗口不遮挡。
3. 用 Dialog、Input、Button 组合新建流程。
4. 用 DropdownMenu 放低频操作，用 Tooltip 说明纯图标按钮。
5. 只使用键盘完成新建、编辑和删除。

下一步学习 [Electron](./electron)，把 Web 界面放进拥有系统能力的桌面应用。
