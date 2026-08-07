# 角色动作生成 · Prompt Craft 原则

动作生图 prompt 的设计原则与反例清单，按重要性排序。

## 1. 8 槽结构先行

动作描述按以下顺序组织，每槽一句：

1. body orientation（身体朝向 / 视角）
2. center of mass（重心位置）
3. torso angle（躯干倾斜 / 扭转）
4. head tilt（头部角度与视线）
5. arm position（手臂位置）
6. hand gesture（手势）
7. leg stance（腿部姿态）
8. foot placement（脚步位置）

结构先于细节。模型拿到顺序后，会优先分配细节预算给肢体变化而非外观复述。

## 2. Canvas / 构图先于主体

生图 prompt 中，构图、比例、裁切要在描述主体之前确定。本项目的标准：

- 全身完整入镜（不截切头顶或脚底）
- 单一角色，主体居中
- 背景干净简单
- 灯光与参考图一致

不写比例时，让 `buildCharacterActionPrompt` 的 `[CANVAS]` 槽显式声明。

## 3. Style Anchor 必须具体且有边界

锚定一种美学 / 媒介 / 生产语境。本项目角色由用户上传，参考图自动决定画风，提示词无需指定。

## 4. Edit Endpoint 不变量 = 动作生成的核心约束

gpt-image-2 处理 `image_urls` 多参考图的逻辑等价于 OpenAI 的 edit endpoint：保留身份 / 构图 / 位置 / 可读性，只改变指定范围。本项目动作生成的"指定范围"= 8 槽内容。

不变量清单（不可改）：

- 脸型、五官布局、发型、肤色、年龄感
- 身材比例（除非动作明确需要透视变形）
- 服装、配饰、鞋子、配色
- 画风、笔触、色调
- 镜头位置、构图、景别、灯光

可变量清单（仅可改这些）：

- body orientation
- center of mass
- torso angle
- head tilt
- arm position
- hand gesture
- leg stance
- foot placement

表述参考："duplicate the neutral model exactly; modify only body orientation, center of mass, torso angle, head tilt, arm position, hand gesture, leg stance, and foot placement"。

## 5. 强负面用 avoid line

模型有概率出现的坏默认：

- 表情随动作变化（动作不涉及表情）
- 服装褶皱 / 配饰位置被动作破坏
- 引入新道具或场景元素
- 截切头顶或脚底
- 视角变成仰拍 / 俯拍导致构图大变
- 写入文字、Logo、水印

集中写在生图 prompt 的 `[CONSTRAINTS]` 段；聊天模型 system 中用禁忌条款拦截。负面不要超过 5 条，避免主导 prompt。

## 6. 场景密度 > 模糊形容词

模糊："走路"、"跑步"、"跳舞"。

具体：

- 走路：重心略前倾，左脚前掌着地、右脚后跟抬起，双臂自然前后摆动
- 跑步：重心明显前倾，前腿蹬直、后腿大幅后摆，双臂屈肘前后大幅摆动
- 跳舞：重心偏一侧，躯干扭转，膝盖微屈，一臂上举一臂侧展

每槽至少给一个具体姿态锚点。不要堆"优雅地"、"有力地"等空形容词。

## 7. 光线 / 配色 / 材质分开控制

本项目动作生成只需控制光线与参考图一致即可。配色与画风由参考图决定，提示词不重复声明。

## 8. 人体结构约束

动作描述需符合人体工程学：

- 关节角度不能违反生理极限（肘不过度反向、膝不过度扭转）
- 重心位置必须合理（双脚着地时重心在两脚之间；单脚着地时身体应有相应平衡补偿）
- 对称动作需明确标注（如"双手对称举起"）
- 视线与头颈角度一致（不可头朝左看但眼珠朝右）

## 9. 单角色 mini-schema

针对角色 + 动作的最简 schema：

- 主体（identity anchor）：参考图提供，不在 prompt 重写
- 动作（action）：8 槽内容
- 画风（style anchor）：参考图提供
- 灯光（lighting）：与参考图一致
- 边界（boundary）：不可改项清单 + 可改项清单

## 角色一致性专项

若用户连点生成多张动作图，prompt 应隐含以下一致性约束：

- 同一角色、同一画风、同一身份
- 仅 8 槽可改项变动
- 不变量严格保持

多张动作可参考上游 `gallery-character-design.md` 的 4 视图 / 多姿态模板思路，但本项目当前为单张生成，保持单图 prompt 即可。
