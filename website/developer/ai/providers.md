# Provider 适配

聊天模型的供应商映射集中在 `shared/chat-model.ts` 和 `electron/providers/chat-provider.ts`。当前实现使用 OpenAI-compatible provider：

| Provider | Base URL                      | 模型                                   |
| -------- | ----------------------------- | -------------------------------------- |
| DeepSeek | `https://api.deepseek.com`    | `deepseek-v4-flash`、`deepseek-v4-pro` |
| MiniMax  | `https://api.minimaxi.com/v1` | `MiniMax-M3`                           |

DeepSeek 额外发送 `thinking: { type: 'disabled' }` provider option；MiniMax 没有这项设置。图片模型使用 APIMart，不走聊天 provider 映射。

## 凭据边界

`electron/services/credentials.ts` 当前允许 `apimart`、`deepseek`、`minimax` 三种服务。凭据存储在应用数据库中，service 根据模型 definition 选择对应凭据；缺少凭据时应返回明确的配置错误。

## 增加聊天 provider

1. 在 `shared/chat-model.ts` 增加模型常量、provider 类型和完整 definition。
2. 增加 `electron/providers/<provider>-provider.ts`，只负责 SDK provider 创建和必要的 provider options。
3. 在 `chat-provider.ts` 增加路由分支。
4. 在 `shared/settings.ts`、凭据服务和设置页面加入允许的 service（如果需要新 key）。
5. 检查图片输入能力、默认模型、错误文案和所有 agent 的模型读取路径。
6. 运行类型检查、构建，并用已配置和未配置凭据两种状态验证错误边界。

不要在 agent 文件里硬编码 base URL、API key 或模型列表；这些都是 provider/model 层的配置。
