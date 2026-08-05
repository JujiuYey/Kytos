# Design: 给图片预览窗口加一个下载按钮

## Goals and non-goals

**Goal.** 在 `ImageViewer` 的工具栏里加一个下载按钮，风格与现有 `缩小/比例/放大/适合窗口` 一致（`size-8` ghost 图标 + Tooltip）。点击后让用户通过 OS 的「保存」对话框，把当前预览的图片保存到任意位置。复用已经存在的 `window.desktop.file.exportFile` IPC（`electron/ipc/files.ts`），不新增 IPC，不修改任何请求/响应类型。

**非目标。**
- 批量下载 / ZIP 导出。
- 复制图片到剪贴板。
- 右键「另存为」上下文菜单、原生拖拽到桌面。
- 保存到工作区或素材库（已有独立的「保存」语义，不要在这一按钮上混入）。
- 改变 `ExportFileRequest` / `ExportFileResult` 契约。
- 未知 MIME 的多格式探测（保持「缺省 png」回退，见 Failure 节）。

## Affected modules and responsibility boundaries

- **新增 `shared/image-formats.ts`** — MIME→扩展名映射的唯一真源（这是相对评审反馈 rev-1 的修订，消除渲染端与主进程两份真源的漂移）。导出：
  - `getMimeTypeExtensions(mimeType: string): string[]` — 供保存对话框 filter 使用：`image/jpeg`→`['jpg','jpeg']`、`image/png`→`['png']`、`image/webp`→`['webp']`，缺省 `['png']`。
  - `getPreferredImageExtension(mimeType: string): string` — 供文件名使用，取数组首项：`jpeg→jpg`、`png→png`、`webp→webp`，缺省 `png`。保证文件名扩展名恒为单个。
- **`electron/ipc/files.ts`** — 删掉本地 `getMimeTypeExtensions`（`files.ts:39-45`），改从 `shared/image-formats` 导入，行为不变。
- **`src/types/index.ts`** — 仿照既有的 `CHARACTER_CREATE_AGENT_ENDPOINT` 再导出（`src/types/index.ts:41`），把 `getMimeTypeExtensions` / `getPreferredImageExtension` 桥接给渲染端。
- **`src/components/sag/image-viewer/ImageViewer.vue`** — 唯一功能性改动文件。增加：新的 `<Tooltip>` + `<Button>`、`Download` 图标、`handleDownload` 异步处理、`isDownloading` 状态、文件名 sanitize。
- **`src/components/sag/image-viewer/index.ts`** — 不变（仍 `export { default as ImageViewer }`）。
- **`electron/preload.ts`、`shared/desktop.ts`** — 不变。`window.desktop.file.exportFile` 契约照旧。
- 五个调用点（`story-workspace-panel.vue:471,653`、`illustration-workspace-panel.vue:166,332`、`expression-image-card.vue:49`、`illustration-library/index.vue:334`、`portrait-gallery.vue:230`）— 不变。

## Key data flow / control flow

1. 用户打开预览对话框（既有流程）。
2. 用户点击新的「下载」按钮 → `handleDownload()`：
   - `isDownloading.value = true`，按钮图标切到 `LoaderCircle`，按钮置 `disabled`。
   - `const response = await fetch(props.src)`。`app://` 协议已通过 `electron/app-protocol.ts:registerAppScheme` 启用 `supportFetchAPI / corsEnabled / secure`，预览图均落在白名单目录，路径越界已防住。
   - `const blob = await response.blob()`；`mimeType = blob.type || 'image/png'`。
   - `extension = getPreferredImageExtension(mimeType)`；`fileName = sanitize(alt || title || 'image') + '.' + extension`。
     - **文件名回退链用 `||`（真值判断）而非 `??`**（这是相对评审反馈 rev-1 的修订）：`ImageViewer.vue` 的 `withDefaults` 把 `alt` 默认置为 `''`，`??` 在空串时不会落到 `title`；`alt || title || 'image'` 保证未传 alt 时正确回退到 title，两者皆空才落 `image`。
     - `sanitize` 只保留 `\p{L}\p{N}._-`，空则回退 `image`。
   - `fileData = new Uint8Array(await blob.arrayBuffer())`。
   - `const result = await window.desktop.file.exportFile({ fileName, mimeType, fileData })`。
   - 取消（`result.canceled === true`）：静默，无 toast，行为对齐常见保存对话框。
   - 成功：`toast.success('图片已导出')`（与 `image-editor/index.vue:319` 文案一致）。
   - 抛错：`toast.error(err.message || '图片下载失败')`。
   - `finally: isDownloading.value = false`，按钮恢复可用。
3. 按钮 `disabled`：`!isLoaded || hasError || isDownloading`，与既有按钮的「加载未就绪不可点」节奏一致（`ImageViewer.vue:233,255,271`）。

## Interfaces, storage and compatibility contracts

无类型/Schema/IPC 变更。`ExportFileRequest = { fileName: string; mimeType: string; fileData: Uint8Array }` 与 `ExportFileResult = { canceled: boolean; filePath: string | null }`（`shared/desktop.ts:74-84`）保持不变。

新增共享模块 `shared/image-formats.ts` 属于内部代码复用，不构成对外契约。`electron/ipc/files.ts` 的 MIME 逻辑从该模块导入后，filter 与渲染端文件名扩展名恒取自同一真源。

## Failure, concurrency, security, migration

- **失败路径覆盖：** fetch 抛错、blob 转换抛错、IPC `Promise` reject — 全部走 `toast.error` + finally 重置按钮。
- **取消：** 用户在保存对话框中取消或关闭预览，对应 `canceled=true` 或组件被卸载；await 流程自然收敛，无 AbortController 需求。卸载后到达的 `finally` 是无害的（无未挂载 UI 写入）。
- **未知/空 MIME：** `getPreferredImageExtension` 与 `getMimeTypeExtensions` 缺省都落 `png`。当前不可达——所有 workspace 服务只产出 png/jpg/webp（`story/illustration/character-*` 服务无 svg 等），故仅保留缺省回退，不做多格式探测。
- **并发：** 单次预览内仅允许一次进行中下载；`isDownloading` 状态 + `disabled` 阻止重复触发。
- **安全：** 无新信任面。`dialog.showSaveDialog` 已限定用户选择路径，`assertTrustedSender`（`electron/ipc/files.ts:19`）继续兜底。`shared/image-formats.ts` 仅字符串映射，无可执行面。
- **迁移：** 无。

## Verification strategy and acceptance criteria

构建与静态检查：
- `pnpm build:web` 通过。
- `pnpm exec oxlint src/components/sag/image-viewer/ImageViewer.vue src/types/index.ts` 干净。
- `pnpm exec oxfmt --check src/components/sag/image-viewer/ImageViewer.vue` 干净。
- `git diff --check` 干净。
- 主进程侧：`electron/ipc/files.ts` 改动仅为「本地函数换成共享导入」，类型检查随 `pnpm build:web` 一并覆盖（tsconfig.node.json 含 `shared/**/*.ts`）。

行为验收（开发者在自己 Electron 会话中核对；不主动启 Electron）：
- 打开任意含 `ImageViewer` 的页面（插画工作台/故事工作台/角色表情卡片/插画库/角色头像库）→ 工具栏出现下载按钮，hover 显示「下载」Tooltip。
- 未加载完成时按钮 `disabled`；图片 error 态时按钮 `disabled`；进行中下载时按钮 `disabled` 且图标为 spinner。
- 点击保存并选择位置 → 文件写入 + `图片已导出` toast。
- 点击保存但取消 → 无 toast，按钮恢复可用。
- 默认文件名：来自 `alt`（如 `故事标题 V1`）或 `title`（当未传 alt 时），sanitize 后追加单个扩展名（`.png/.jpg/.webp`），不得出现 `foo.jpg,jpeg` 之类的多扩展名。

## Task breakdown and dependencies

四个文件的改动，其中三个是搬运/桥接，功能逻辑集中在 `ImageViewer.vue`：
1. 新增 `shared/image-formats.ts`（映射 + 两个导出）。
2. `electron/ipc/files.ts` 改为共享导入（删本地函数）。
3. `src/types/index.ts` 桥接再导出。
4. `ImageViewer.vue` 实现按钮 + `handleDownload`。

「完成」=：上述静态检查全部通过 + 行为清单前 6 项由开发者在自己的 Electron 会话中验过，把证据贴回（尤其确认未传 alt 的调用点也产出 title 文件名）。

引用：
- 目标组件：`src/components/sag/image-viewer/ImageViewer.vue:175-285`
- 复用 IPC：`electron/ipc/files.ts:16-30`
- 被搬移的本地映射：`electron/ipc/files.ts:39-45`
- 类型契约：`shared/desktop.ts:74-84`
- 既有 IPC 桥：`electron/preload.ts:184-189`
- 渲染端共享桥接先例：`src/types/index.ts:41`
- 协议层（fetch 走它）：`electron/app-protocol.ts:8-53`
- 风格参照（图像编辑器导出）：`src/components/sag/image-editor/index.vue:282-325`
