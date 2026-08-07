# 角色表情生成 · Prompt Craft 原则

本文件是 wuyoscar/GPT-Image2-Skill `references/craft.md` 的蒸馏版，专为本项目角色表情生成场景裁剪。完整 19 段原文见上游仓库；本文件保留与表情直接相关的 8 段并补一个角色一致性专项。

## 1. 6 槽结构先行

表情描述按以下顺序组织，每槽一句：

1. 情绪强度（mild / moderate / strong）
2. 眉部动作
3. 眼部 + 视线
4. 嘴部
5. 面部肌肉支撑
6. 头部或上半身姿态

结构先于细节。模型拿到顺序后，会优先分配细节预算给五官变化而非外观复述。

## 2. Canvas / 构图先于主体

生图 prompt 中，构图、比例、裁切要在描述主体之前确定。本项目的标准：

- 头肩像或半身像
- 主体居中，轮廓完整可见
- 背景干净简单
- 柔和正面光

不写比例时，让 `buildExpressionPrompt` 的 `[CANVAS]` 槽显式声明。

## 3. Style Anchor 必须具体且有边界

锚定一种美学 / 媒介 / 生产语境：

- 不可："好看的"、"精致的"（空泛）
- 可："MAPPA 风格数字 2D 动画"、"Studio Pierrot 写实赛璐璐"、"新中式视觉、轻奢克制"

若引用在世工作室 / IP 美学，保持原创作角色，避免直接复制以避免用于发布场景。本项目角色由用户上传，参考图自动决定画风，提示词无需指定。

## 4. Edit Endpoint 不变量 = 表情生成的核心约束

gpt-image-2 处理 `image_urls` 多参考图的逻辑等价于 OpenAI 的 edit endpoint：保留身份 / 构图 / 位置 / 可读性，只改变指定范围。本项目表情生成的"指定范围"= 6 槽内容。

不变量清单（不可改）：

- 脸型、五官布局、发型、肤色、年龄感
- 服装、配饰、配色
- 画风、笔触、色调
- 镜头位置、构图、景别

可变量清单（仅可改这些）：

- eyebrows 形态
- eyelids 开合
- gaze direction
- mouth shape
- cheek tension
- head tilt
- 少量支撑表情的上半身姿态

表述参考："duplicate the neutral model exactly; modify only brows, eyelids, gaze, mouth, cheeks, and head tilt"。

## 5. 强负面用 avoid line

模型有概率出现的坏默认：

- 把表情失真扩散到服装或画风
- 生成漫画分格、对话框、剧情插画
- 重复五官 / 多余人物 / 截切轮廓
- 写入文字、Logo、水印

集中写在生图 prompt 的 `[CONSTRAINTS]` 段；聊天模型 system 中用禁忌条款拦截。负面不要超过 5 条，避免主导 prompt。

## 6. 场景密度 > 模糊形容词

模糊："高兴"、"悲伤"。

具体：

- 高兴：嘴角上扬露齿、颧骨上提、眼角微眯
- 悲伤：眉头轻蹙、嘴角下拉、下眼睑微松
- 愤怒：眉心紧锁、上唇上提露出牙齿、鼻翼两侧纹路加深

每槽至少给一个具体动作锚点，不要堆"非常""极其""特别"等空形容词。

## 7. 光线 / 配色 / 材质分开控制

不要压缩成"高级感"。本项目表情生成只需控制光线：

- 默认：柔和正面光
- 戏剧化场景：可用侧光 + 强阴影（仅在用户描述明确指向时）

配色与画风由参考图决定，提示词不重复声明。

## 8. Anime / 角色 mini-schema

针对角色 + 表情的最简 schema：

- 主体（identity anchor）：参考图提供，不在 prompt 重写
- 动作 / 表情（action）：6 槽内容
- 画风（style anchor）：参考图提供
- 灯光（lighting）：本项目默认柔和正面光
- 边界（boundary）：不可改项清单 + 可改项清单

## 角色一致性专项（仅适用于多张表情一起生成时）

当前项目是单张生成，但若用户连点生成多张表情，prompt 应隐含以下一致性约束：

- 同一角色、同一画风、同一身份
- 仅 6 槽可改项变动
- 不变量严格保持

若未来支持一次性生成 N 张表情矩阵（如 3×3 / 4×4 grid），可参考上游 `gallery-anime-and-manga.md` No. 5 的 16-panel expression grid 模式：

```
Create a 16-panel expression grid of a <character>.
Her face shape, hairstyle, and clothing must remain highly consistent
across all panels. The 16 expressions should include: ...
```

并显式增加 `face shape, hairstyle, and clothing must remain highly consistent across all panels` 这条不变量。
