---
title: 安装与首次启动
description: 从源码启动 Kytos，并完成本地工作区初始化。
---

# 安装与首次启动

Kytos 目前是持续开发中的 Electron 桌面应用。本页说明如何从源码启动开发环境，以及首次打开应用时怎样建立作品工作区。

## 环境要求

- Node.js 22.12 或更高版本
- pnpm 10
- Git
- 可运行 Electron 的桌面环境

::: info
仓库锁定了 pnpm 版本，建议通过 Corepack 使用项目声明的版本，避免不同包管理器改写锁文件。
:::

## 获取并启动项目

```bash
git clone https://github.com/JujiuYey/Kytos.git
cd Kytos
pnpm install
pnpm dev
```

`pnpm dev` 会启动 Electron Forge 开发环境。Kytos 的页面运行在渲染进程中，本地文件、系统凭据和外部模型请求通过 preload 暴露的 `window.desktop` API 交给主进程处理。

## 选择作品工作区

首次启动时，Kytos 会要求选择作品存储位置。你可以：

1. 使用系统文档目录下推荐的 `Kytos` 文件夹。
2. 选择另一个拥有写入权限的绝对路径。

确认后，应用会检查目录是否可写，并创建 `assets/` 目录。角色资料、生成记录和图片资产会保存在这个工作区中。

::: warning 切换工作区不会迁移文件
之后可以在“系统设置 → 基本配置”中切换工作区。Kytos 不会自动移动或删除旧工作区的数据。
:::

## 完成模型配置

进入应用后，打开“系统设置”：

1. 在“默认模型”中选择通用模型、快速模型和生图模型。
2. 在“模型厂商”中配置对应的 API Key。
3. 回到“创建角色”或其他创作页面开始工作。

不同任务会读取不同模型设置。详细对应关系见[模型与凭据](./providers)。

## 下一步

- [创建角色并管理视觉资产](../guide/character)
- [开始插画创作](../guide/illustration)
- [了解工作区和数据边界](../guide/workspace)
