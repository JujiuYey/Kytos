# 发布

发布文档只描述当前可验证的制品流程。版本、平台和签名能力以 `package.json`、`forge.config.ts` 及实际构建输出为准。

## 当前发布边界

- 版本号位于根目录 `package.json`，当前仓库版本为 `0.1.0`。
- Forge 当前只有 macOS ZIP maker。
- 仓库内现有 GitHub Actions 只部署 VitePress 文档，没有桌面应用自动发布流程。
- 代码没有在 Forge 配置中声明开发者证书、notarization 或自动更新服务。

## 手动发布清单

1. 更新 `package.json` 版本，并检查用户可见的变更说明。
2. 运行 `pnpm build:web` 和受影响文件的 lint/format 检查。
3. 在目标 macOS 环境运行 `pnpm make`。
4. 检查 `out/make/` 中的 ZIP 文件、架构和版本名称。
5. 在干净的测试环境验证首次启动、工作区配置、凭据设置和核心生成流程。
6. 创建与版本号一致的 Git tag 和 GitHub Release，上传实际生成的 ZIP。
7. 记录制品校验值和已验证的平台，不把未验证的平台写入发布说明。

## 发布前必须补齐的决定

如果要发布签名包、DMG、Windows/Linux 制品或自动更新，需要先在 Forge 配置、CI secrets、证书/notarization 和回滚策略上做出明确设计，再更新这里的文档。不要用成本估算或路线图文字代替可执行配置。
