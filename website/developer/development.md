---
title: 本地开发
description: Kytos 的开发命令、代码约定和文档发布流程。
---

# 本地开发

开始修改前请阅读仓库根目录的 [`AGENTS.md`](https://github.com/JujiuYey/Kytos/blob/main/AGENTS.md)。它定义了组件来源、Vue 风格、页面高度、滚动区域和验证要求。

## 常用命令

```bash
# 启动 Electron 开发环境
pnpm dev

# Vue / TypeScript 构建
pnpm build:web

# 类型检查
pnpm typecheck

# 全仓静态检查
pnpm lint
```

常规开发验证不需要运行 Electron Forge 打包。`pnpm build`、`pnpm package` 和 `pnpm make` 只在明确需要桌面打包产物时使用。

## 修改前端页面

- 页面入口使用 `src/views/<feature>/index.vue`。
- 页面私有组件放在对应 feature 的 `components/`。
- 通用交互优先组合 `src/components/ui/`。
- AI 对话优先使用 `src/components/ai-elements/`。
- 应用级业务组合放在 `src/components/sag/`。
- 渲染端只通过 `window.desktop` 访问主进程能力。

所有 Vue SFC 使用 `<script setup lang="ts">`，并按业务逻辑组织 Composition API 状态、派生值、副作用和方法。

## 验证改动

根据改动范围执行最小且充分的检查：

```bash
pnpm build:web
pnpm exec oxlint <changed-files>
pnpm exec oxfmt --check <changed-files>
git diff --check
```

仓库禁止代码代理主动启动 Electron、开发服务器或浏览器进行视觉验收。界面视觉检查由开发者手动完成。

## 开发文档站

```bash
# 本地编辑
pnpm docs:dev

# 生成静态站点
pnpm docs:build

# 预览构建产物
pnpm docs:preview
```

文档源码位于 `website/`，构建产物位于 `website/.vitepress/dist/`。不要提交构建产物。

Kytos 是 GitHub 项目站，VitePress 的生产 `base` 配置为 `/Kytos/`。新增站内链接时优先使用 Markdown 相对链接；自定义 Vue 组件中的静态链接需要包含该 base，或使用 VitePress 的路径辅助方法。

## GitHub Pages 发布

`.github/workflows/deploy-docs.yml` 会在 `main` 分支的文档、站点配置或首页视觉资产变化时：

1. 安装锁定的 pnpm 依赖。
2. 执行 `pnpm docs:build`。
3. 上传 `website/.vitepress/dist`。
4. 部署到 GitHub Pages。

首次发布前，需要在仓库 `Settings → Pages` 中把 Source 设置为 **GitHub Actions**。之后推送到 `main` 会自动更新站点，也可以从 Actions 页面手动运行工作流。
