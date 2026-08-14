---
title: 构建与发布
description: pnpm make 链路、GitHub Release 流程、代码签名现状、0.2.0 路线。
---

# 构建与发布

0.1.0 已经发布。本页讲清当前流程、0.2.0 应该改哪些、为什么签名这件事 0.2.0 还没做。

## 当前发布渠道

| 平台                | 安装包                         | 状态                           |
| ------------------- | ------------------------------ | ------------------------------ |
| macOS Apple Silicon | `Kytos-darwin-arm64-0.1.0.zip` | ✅ 0.1.0 已发布                |
| macOS Intel         | —                              | 0.2.0 计划                     |
| Windows x64         | —                              | 0.2.0 计划                     |
| Linux               | —                              | 不在路线图                     |
| npm publish         | —                              | 仓库 `private: true`，不发 npm |

安装包**未签名**——macOS 首次启动需 "系统设置 → 仍要打开"。Windows 包还没产出。

## `pnpm make` 链路

```bash
pnpm make
# 内部跑：vue-tsc -b && electron-forge make
```

两步：

1. **类型检查 + 打包**——`vue-tsc` 编译 `.ts/.vue`，Vite 产出 `out/Kytos-darwin-arm64-0.1.0.app`
2. **makers 阶段**——`electron-forge make` 把 `.app` 包成可分发包

当前 `forge.config.ts` 只配了一个 maker：

```ts
// forge.config.ts:1-12 节选
import { MakerZIP } from '@electron-forge/maker-zip';

const config = {
  packagerConfig: {
    appBundleId: 'com.jujiuyey.kytos',
    asar: true,
    executableName: 'Kytos',
    name: 'Kytos',
  },
  rebuildConfig: {},
  makers: [new MakerZIP({}, ['darwin'])],
  // ...
};
```

产物落在 `out/make/zip/darwin/<arch>/Kytos-darwin-<arch>-<version>.zip`。

## 发布一个版本（如 0.2.0）

最小手动流程：

```bash
# 1. 改 package.json 的 version（手动）
# 2. (可选) 改 forge.config.ts 加 makers / 加签名配置
# 3. 提交改动

git add package.json forge.config.ts pnpm-lock.yaml
git commit -m "chore(release): 0.2.0"
git tag v0.2.0
git push origin main --tags

# 4. 构建
pnpm make

# 5. GitHub 网页操作
#    - 进 Releases 页 "Draft a new release"
#    - 选 v0.2.0 tag
#    - 把 out/make/zip/darwin/arm64/*zip 拖上去
#    - 勾 "Set as the latest release" + "Pre-release"（如果发布前还没测全）
#    - 描述里写清楚 Gatekeeper / SmartScreen 操作
```

::: tip 0.2.0 的可能增量

- 加 `MakerDMG` 做 .dmg
- 加 `win32` 到 `MakerZIP` 平台
- 加 `packagerConfig.osxSign` / `osxNotarize` 做签名
- 加 `.github/workflows/release.yml` 自动打包
  四个独立开关，下面分节讲为什么 0.1.0 都没做。
  :::

## 我没做的事（按优先级）

### 1. dmg maker（暂缓）

`MakerDMG` 依赖 `macos-alias` 这个 native module。装包时它需要 prebuilt 或本地编译。在国内网络下不稳，0.1.0 试过一次没成，撤了。

要做 0.2.0 时：

```bash
pnpm add -D @electron-forge/maker-dmg
```

`forge.config.ts` 加：

```ts
import { MakerDMG } from '@electron-forge/maker-dmg';

makers: [
  new MakerZIP({}, ['darwin']),
  new MakerDMG({}, ['darwin']),
],
```

如果 prebuilt 拉不到：

```bash
# 装 Xcode 命令行工具
xcode-select --install
# 单独 rebuild native module
pnpm rebuild macos-alias
```

### 2. 代码签名（0.2.0 不计划）

签名档的现状（2026-08 行情）：

| 厂商                      | 类型           | 价格               | 备注                     |
| ------------------------- | -------------- | ------------------ | ------------------------ |
| Certum                    | Open Source EV | ~$25/年 + 项目审核 | 面向开源，便宜但慢       |
| DigiCert                  | EV             | ~$400/年           | 标准                     |
| Microsoft Trusted Signing | OV             | ~$10/月            | Azure 平台，部分地区不开 |

签名后果：

- **macOS 没签名** → 第一次启动被 Gatekeeper 拦一次（→ 系统设置 → 仍要打开）
- **Windows 没签名** → 蓝条 SmartScreen → More info → Run anyway

0.1.0 **故意不签**就发。理由：

- 个人 / 小团队用 #签名 实际是 anti-pattern：开发者机已经信任，自己用不到
- macOS 用户首次一拦就过；Windows 多一步 Run anyway 不会漏
- 走 Certum 需先过"开源项目认证流程"，时间成本高
- 真要签名也会从 Certum 开始（最便宜），不做满 $400/年档

需要时再加。**0.2.0 不计划**。

### 3. GitHub Actions 自动发布（暂缓）

当前发布是手动的。`.github/workflows/deploy-docs.yml` 只管 docs 站发布，不管桌面端：

```yaml
# .github/workflows/deploy-docs.yml:23-54 节选
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      # ...
      - name: Build documentation
        run: pnpm docs:build
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v4
```

桌面端自动发需要一个**新 workflow**（比如 `release.yml`），骨架：

```yaml
name: Build desktop release
on:
  push:
    tags: ['v*']
jobs:
  release:
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm make
      - uses: softprops/action-gh-release@v2
        with:
          files: out/make/**/*
```

**0.2.0 之前不引入**。理由：

- 手动跑过 1-2 次确认链路稳再加自动化，避免一开始就在 CI 里盲排
- macOS runner 消耗配额 10×，私有仓库每月 2000 min 不算宽裕
- 当前每月发版频率约 1 次，手动 10 分钟搞定，自动化收益不显著

## 0.2.0 备忘清单

下次发布前，开 PR 时按这个清单检查：

- [ ] version 升到 `0.2.0`
- [ ] `forge.config.ts` 加 makers
- [ ] （可选）签名配置
- [ ] README 同步产品定位 / 下载链接
- [ ] 网站 `pnpm docs:dev` 跑一遍，肉眼扫一遍 guide
- [ ] pnpm make 在干净 macOS 上跑通
- [ ] tag + push + GitHub Release

## 验证发布的最小验收

发布一个版本后，做这三件事算交付完整：

- [ ] `git tag` 显示 `v<x>.<y>.<z>` 已推到 origin
- [ ] GitHub Release 页面有 download 入口（pre-release 也算）
- [ ] 在干净的 macOS 机器上下载 zip、解压、跑通核心工作流

::: danger 不要在 CI 修视觉
仓库约定：发布前不主动跑 `pnpm make` 做视觉验收。Release 在已构建产物 + 描述清楚的形态下交付，视觉问题由用户在使用后反馈。
:::

## 下一步读

- [本地开发](./development) —— 改代码到提交
- [项目架构](./architecture) —— 读懂 5 层结构
