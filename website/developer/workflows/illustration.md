# 插画工作流

插画功能由 `/illustration` 创作页和 `/illustration-library` 管理页组成。它把“画面 brief”“参考材料”“生成版本”分开保存，便于修改 brief 后重新生成，而不覆盖历史版本。

## 从 brief 到版本

1. 页面创建或打开一个 illustration topic。
2. 用户输入主体、环境、构图、风格、情绪等信息，并可选择角色参考或上传素材。
3. `electron/agents/illustration-agent/` 的 agent 最多运行 4 步：`updateIllustrationBrief` 保存补充信息，`presentIllustrationPlan` 保存可确认的完整方案。
4. 用户明确确认方案后，illustration generation service 创建任务并调用图片模型。
5. 页面使用 task id 查询状态，完成后把生成图片写入工作区并创建 version/image 记录。
6. `/illustration-library` 展示主题、版本、图片和上传参考，不修改历史版本的原始记录。

## 数据与引用

插画服务位于 `electron/services/illustration/`：

- `schema.ts` 定义主题、版本、版本图片、角色引用和上传素材。
- `reference-images.ts` 处理上传参考材料。
- `generation.ts` 负责任务创建和图片结果落盘。
- `assets.ts` 负责工作区内图片的路径和清理。

角色参考通过引用传递，不把角色图片复制成另一份无主数据。修改角色官方视觉后，已有插画版本仍应指向当时保存的版本引用。

## 排查顺序

先确认 topic/brief 是否保存，再确认 IPC 是否创建 task，接着查看 task 状态和资产文件，最后检查 version/image 记录。不要只看页面是否出现了 loading。
