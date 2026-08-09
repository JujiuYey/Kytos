# Kytos

Kytos 是一个本地优先的 AI 角色与视觉内容创作工作台。

它把角色创建、角色视觉、表情、插画和故事创作放在同一个桌面应用中。
作品文件保存在你选择的本地工作区，模型凭据由操作系统安全存储保护。

[完整文档](https://jujiuyey.github.io/Kytos/) · [快速开始](https://jujiuyey.github.io/Kytos/getting-started/) · [开发架构](https://jujiuyey.github.io/Kytos/developer/architecture)

> 项目状态：持续开发中。界面和 AI 工作流可能继续调整。

## 功能

### 角色形象

- 创建角色：选择视觉风格，提供可选参考图，生成多张候选形象。
- 角色管理：创建、选择、重命名和删除角色。
- 角色视觉：管理正式角色视觉、动作图片和角色参考板。
- 表情管理：基于角色参考生成、上传、重命名和整理表情素材。

![创建角色页面](docs/screenshots/02-character-create.png)

![角色管理页面](docs/screenshots/03-character-library.png)

![角色视觉与表情页面](docs/screenshots/04-character-assets.png)

### 内容创作

- 插画创作：通过 AI 共创对话整理主题，生成并管理插画版本。
- 插画创作 Beta：体验基于画布节点的插画工作流。
- 插画管理：集中查看、上传、删除和整理插画资产。
- 故事管理：创建、打开和删除故事项目。
- 故事创作：通过 AI 共创对话编辑故事、分镜和画面版本。

![插画创作页面](docs/screenshots/05-illustration-create.png)

![插画管理页面](docs/screenshots/06-illustration-library.png)

![故事创作页面](docs/screenshots/07-story-create.png)

## 安装

需要 Node.js、pnpm 和可用的桌面开发环境。

```bash
pnpm install
```

## 快速开始

启动 Electron 开发环境：

```bash
pnpm dev
```

首次启动时，选择作品工作区。
默认推荐目录是系统文档目录下的 `Kytos` 文件夹。

然后打开“系统设置”，配置需要使用的模型服务凭据。

## 配置外部服务

Kytos 不读取项目根目录中的 `.env` 来保存用户凭据。
请在应用的“系统设置 → 模型厂商”中完成配置。

| 配置     | 用途                                           |
| -------- | ---------------------------------------------- |
| DeepSeek | DeepSeek V4 Flash / Pro 对话和内容整理         |
| MiniMax  | MiniMax M3 文本与多模态共创                    |
| APIMart  | GPT-Image-2 角色视觉、表情、插画和故事画面生成 |

应用只在主进程调用外部服务时读取 API Key。
已保存的 API Key 不会回传到渲染界面。

![系统设置页面](docs/screenshots/08-settings.png)

## 使用流程

### 创建第一个角色

1. 打开“创建角色”。
2. 选择一个视觉风格，或跳过风格选择。
3. 上传一张可选参考图。
4. 点选角色的核心方向。
5. 生成四张候选整图。
6. 选择一张候选图作为基础形象。
7. 生成 2K 精修图。
8. 保存为角色正式视觉。

### 开始插画创作

1. 先在“角色管理”中选择角色。
2. 打开“插画创作”。
3. 描述主题、场景和画面要求。
4. 按需选择角色参考和输出设置。
5. 等待生成任务完成。
6. 在版本列表中选择需要保留的结果。

### 开始故事创作

1. 打开“故事管理”。
2. 创建一个故事项目。
3. 进入“故事创作”。
4. 与 AI 共创故事内容。
5. 创建并编辑故事分镜。
6. 生成、选择和管理分镜画面版本。

## 数据存储

作品工作区由用户选择，应用会在其中创建 `assets/` 目录。

角色资料、角色草稿、生成记录和图片资产都保存在该工作区。
切换工作区不会自动移动或删除旧目录中的文件。

应用设置保存在 Electron 的用户数据目录中。
API Key 使用系统安全存储，不写入作品工作区。

## 开发

构建 Web 渲染端并执行 TypeScript 检查：

```bash
pnpm build:web
```

执行静态检查：

```bash
pnpm lint
```

检查格式：

```bash
pnpm exec oxfmt --check README.md
```

启动文档站：

```bash
pnpm docs:dev
```

构建文档站：

```bash
pnpm docs:build
```

创建 macOS 打包产物：

```bash
pnpm make
```

## 项目结构

```text
electron/                 Electron 主进程、IPC 和本地服务
shared/                   主进程与渲染端共享的类型和协议
src/views/                按功能划分的页面入口
src/components/ui/        通用 UI 原语
src/components/ai-elements/ AI 交互组件
src/components/sag/       Kytos 业务组合组件
src/stores/               Pinia 状态管理
src/router/               Vue Router 路由
src/assets/               内置图片和风格素材
scripts/                  本地辅助脚本
website/                  VitePress 文档站源码
.github/workflows/        GitHub Pages 自动发布流程
```

## 贡献

1. 创建一个功能分支。
2. 保持改动聚焦，并遵循 `AGENTS.md` 中的仓库约定。
3. 修改后运行 `pnpm build:web`。
4. 对改动文件执行 lint、格式检查和 `git diff --check`。
5. 提交清晰的变更说明。

## 许可

Kytos 使用 MIT License，详见 [LICENSE](LICENSE)。
