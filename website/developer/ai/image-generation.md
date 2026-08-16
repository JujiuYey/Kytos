# 图片生成

图片生成是异步任务，不是一次 IPC 调用就返回图片。插画、角色视觉、角色表情和故事分镜都遵循“提交任务 -> 轮询 -> 下载资产 -> 写回领域状态”的路径。

## 通用路径

```text
validate request
  -> resolve explicitly selected references
  -> build gpt-image-2 request
  -> submitImageTask
  -> save submitted task id
  -> pollImageTask
  -> downloadTaskImages
  -> save completed version/record and file references
```

任务状态包括 `submitted`、`pending`、`processing`、`completed`、`failed` 和 `cancelled`。完成前不能删除正在生成的版本；失败和取消要把错误信息写入领域记录，让页面可以重试或清理。

## 各领域入口

| 领域          | 提交与轮询                                             |
| ------------- | ------------------------------------------------------ |
| 插画          | `electron/services/illustration/generation.ts`         |
| 角色动作/锚点 | `electron/services/character-visual/generation.ts`     |
| 角色表情      | `electron/services/character-expression/generation.ts` |
| 故事分镜      | `electron/services/story/generation.ts`                |

图片服务当前使用 APIMart 凭据和 `gpt-image-2` 请求格式。参考图必须从当前工作区和明确选择的角色/版本引用解析，不能回退到全局选中状态。

## 任务问题排查

先检查请求是否被领域校验拒绝，再检查 task id 是否保存，随后查看远端状态和下载结果，最后确认数据库记录与资产文件是否一致。不要用页面上的“生成中”文案判断远端任务是否仍在运行。
