# 构建

Kytos 的构建分成 Web 构建、Electron 打包和发布制品三个层次。

## 常用命令

| 命令              | 作用                                                        |
| ----------------- | ----------------------------------------------------------- |
| `pnpm build:web`  | 类型检查并构建 Vue renderer                                 |
| `pnpm package`    | 类型检查并执行 `electron-forge package`，生成本地可运行目录 |
| `pnpm make`       | 类型检查、打包并执行 Forge maker，生成发布制品              |
| `pnpm docs:build` | 构建 `website/` 下的 VitePress 文档                         |

`pnpm build` 与 `pnpm package` 当前都走 Electron Forge package；日常验证优先使用 `pnpm build:web`，不要把 Electron 完整打包当成每次局部改动的默认检查。

## Forge 当前配置

`forge.config.ts` 使用 VitePlugin 构建：

- main：`electron/main.ts`
- preload：`electron/preload.ts`
- renderer：`main_window`
- 应用 id：`com.jujiuyey.kytos`
- `asar: true`
- executable：`Kytos`
- maker：仅 `MakerZIP({}, ['darwin'])`

因此当前仓库明确配置的是 macOS ZIP，不应在文档或脚本中宣称 Windows、Linux、DMG 或签名安装包已经支持。

## 构建前检查

1. 确认 `package.json` 版本和变更范围。
2. 运行 `pnpm build:web`。
3. 运行受影响文件的 oxlint/oxfmt 检查。
4. 需要桌面制品时再运行 `pnpm package` 或 `pnpm make`。
5. 检查输出目录中是否只有预期平台和文件，并运行 `git diff --check`。
