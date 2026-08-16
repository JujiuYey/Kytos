# 前端边界

## 路由与页面

路由集中在 `src/router/index.ts`。当前主要页面是：

| 路径                    | 用途                         |
| ----------------------- | ---------------------------- |
| `/setup`                | 首次配置工作区，独立于主布局 |
| `/character-create`     | 创建角色草稿和生成初始资产   |
| `/character`            | 角色库                       |
| `/character-anchor`     | 角色锚点与参考图             |
| `/character-action`     | 动作资产                     |
| `/character-expression` | 表情资产                     |
| `/illustration`         | 插画创作                     |
| `/illustration-library` | 插画版本和素材               |
| `/stories`、`/story`    | 故事列表与故事编辑           |
| `/setting`              | 工作区和模型设置             |

根布局负责导航和高度边界，页面根节点使用 `h-full min-h-0 overflow-hidden`。页面内真正需要滚动的区域使用 `ScrollArea`，不要让 body 或整个路由页面滚动。

## 状态归属

- 页面当前选择、面板开关和输入草稿属于 view 或页面私有组件。
- 需要跨页面复用的角色库和应用状态放在 `src/stores/`。
- 服务器事实、任务状态和持久化数据通过 `window.desktop` 获取，不能复制一份长期真相到组件里。
- 可由其他状态计算出的值使用 `computed`，不要重复存储。

异步操作必须显式呈现 loading、empty、error 和 disabled 状态。长任务通常由主进程返回 task id，页面再通过对应 API 查询或订阅状态。

## 组件边界

- 通用交互优先组合 `src/components/ui/`。
- 对话、消息和 prompt 输入优先组合 `src/components/ai-elements/`。
- Kytos 特有的业务组件放在 `src/components/sag/` 或对应 view 的 `components/`。
- 不在业务页面重写 Button、Dialog、Input、ScrollArea 或聊天气泡。

新增页面时，先确定路由、页面拥有的状态、需要的 desktop API，再决定是否提取业务组件。页面组件负责流程编排，复杂展示和可复用交互下沉到 feature component 或 composable。
