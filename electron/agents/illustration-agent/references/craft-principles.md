# 插画共创 · Prompt Craft 原则

插画 brief 与 finalPrompt 的设计原则与反例清单，按重要性排序。

## 1. 场景驱动 · 不堆砌空形容词

**结构化原则**：插画 brief 8 字段（title / subject / action / environment / composition / mood / style / details）按"主体 → 动作 → 环境 → 构图 → 氛围 → 画风 → 细节"顺序构建。

每个字段都要给具体可画的锚点：

- subject → 实体 + 数量 + 位置
- action → 动作动词 + 程度 + 方向
- environment → 地点 + 时间 + 氛围元素
- composition → 镜头 + 景别 + 取景
- mood → 情绪基调 + 视觉对应（不要"美"这种不可画词）
- style → 媒介 / 笔触 / 美学锚定
- details → 关键道具 / 文字 / 标识

## 2. Canvas / 构图先于主体

finalPrompt 中构图与镜头先于主体描述。具体可参考上游 `gallery-ui-ux-mockups.md`、`gallery-cinematic-and-animation.md`：

- WIDE / OTS / CU / low angle / aerial / match cut / pan-tilt-static
- "Landscape 16:9 academic concept figure..."
- "A 6-panel film storyboard laid out as a 3×2 grid..."

## 3. Style Anchor 必须具体且有边界

锚定一种美学 / 媒介 / 生产语境：

- 不可："好看的"、"精致的"（空泛）
- 可："新中式视觉、轻奢克制"、"gongbi 级建筑细节配松散水墨氛围"、"Swiss grid discipline meets friendly risograph"

若引用在世工作室 / IP 美学，保持原创作角色，避免直接复制以避免用于发布场景。

## 4. Edit Endpoint 不变量

当本次画面加入角色素材时，角色视觉会作为 `image_urls` 附加。brief 中**不要**重写角色外形、表情、画风、服装、身材。finalPrompt 只描述该角色在本次画面中的具体表现。

不变量：

- 脸型、五官、发型、肤色、年龄感
- 服装、配饰、配色
- 画风、笔触、色调（来自角色视觉）

可变量：

- 姿态动作
- 场景环境
- 镜头构图
- 画面氛围
- 配饰状态（如"摘下帽子"、"打开伞"）

## 5. 强负面用 avoid line

finalPrompt 末尾必须有约束清单：

- 不重新设计角色（启用角色时）
- 不输出漫画分格 / 对话框（除非明确是漫画类）
- 不新增未声明的道具
- 不输出文字、Logo、水印（除非 brief 明确要求）
- 不输出图像比例 / 分辨率（界面单独传）

## 6. 文字渲染规则

若画面含文字（海报 / 招牌 / 屏幕 UI / 服装 logo）：

- 字面文字加引号：`"FRESH AND CLEAN"`
- 指定字体（sans-serif / serif / 书法）+ 大小 + 颜色 + 位置
- 必要时逐字母写（生僻字 / 商标）
- 指定 `quality=high`（通过界面选项而非 prompt）

参考上游 `gallery-typography-and-posters.md` 的 13 个真实案例。

## 7. 多参考图的角色分工

若画面中要保持某个视觉元素不变（如角色）+ 引入新元素（如新场景），应在 brief 中描述：

- 哪些元素来自角色视觉（保持）
- 哪些元素是新增 / 修改（变化）

## 8. 镜头 / 取景 / 景别

finalPrompt 必须明确：

- 镜头距离：极远景 / 远景 / 全景 / 中景 / 近景 / 特写 / 大特写
- 视角：平视 / 俯视 / 仰视 / 鸟瞰 / 虫视角
- 取景：居中 / 偏左 / 偏右 / 留白方向

模糊："看着"、"看着像" → 不可画。
具体："近景特写，平视，人物居中偏右，左侧留白给场景"。

## 9. Agent 工作流约束

作为多轮 Agent，prompt 本身需要让模型：

- 不主动编造用户未确认的事实
- 一次最多追问一个问题
- 信息足够时直接给 finalPrompt
- finalPrompt 中区分"用户已确认"与"我建议"的边界（通过语气词）
- 不在 finalPrompt 写入尺寸 / 分辨率 / 模型参数（界面单独传）
- 不声称图片已生成（付费生图由用户在界面触发）

## 10. 类别 mini-schema

- **海报 / 广告**：promotional hierarchy（产品名最大 → tagline → SKU → CTA → 备注）
- **角色场景**：character anchor + new scene delta + preserve list
- **UI 截图**：screen type + 层级 + 真实文案 + 状态 + 布局逻辑 + 字体行为
- **数据可视化**：chart family + canvas + 精确标签 + 视觉编码 + 一致比例

参考上游 `gallery-ui-ux-mockups.md` / `gallery-data-visualization.md` / `gallery-research-paper-figures.md`。
