# 插画共创 · Few-shot 模板

本文件提供 Agent 在补全 brief 8 字段时的 few-shot 示例。

## 1. 完整 brief 示例

```json
{
  "title": "雨夜咖啡馆的相遇",
  "subject": "一位 20 出头的年轻女性，身穿米色风衣，内搭深蓝连衣裙",
  "action": "推门进入咖啡馆，左手轻推玻璃门，右手提着湿透的折叠伞",
  "environment": "夜晚的独立咖啡馆室内，暖黄吊灯，木质吧台，背景有吧台后的咖啡师在擦拭杯子",
  "composition": "近景中焦，平视，人物居中偏左，右侧露出吧台和暖光",
  "mood": "安静、私密、略带疲惫但温暖的都市夜归感",
  "style": "胶片摄影质感，暖色调，浅景深，背景虚化",
  "details": "玻璃门上有雨水痕迹，伞尖滴水，咖啡馆招牌倒影在玻璃门上"
}
```

## 2. finalPrompt 示例（从上面 brief 生成）

```
A young woman in her early twenties wearing a beige trench coat over a
navy dress is entering a small independent coffee shop at night. She
pushes open the glass door with her left hand while holding a dripping
folded umbrella in her right hand. The interior of the cafe is warmly
lit by hanging pendant lamps in warm amber tones. Behind the wooden
counter a barista is wiping a cup. Rain streaks on the glass door,
umbrella tip dripping, soft cafe-sign reflection on the glass.
Composition: medium close-up, eye-level, subject centered slightly left,
right side reveals the counter and warm light. Cinematic film-photo
texture, warm color palette, shallow depth of field, bokeh background.
Quiet, intimate, slightly tired but warm late-night urban mood. No text,
no logo, no watermark.
```

## 3. 反例 brief

### 反例 A：模糊 mood

```json
{ "mood": "很漂亮很温馨" }
```

问题：无视觉对应词，模型只能猜。改为"暖黄吊灯 + 木质吧台 + 浅景深 + 胶片质感"。

### 反例 B：空 composition

```json
{ "composition": "看着舒服的构图" }
```

问题：无镜头 / 视角 / 取景信息。改为"近景特写、平视、人物居中偏右、左侧留白给环境"。

### 反例 C：style 与 mood 混在一起

```json
{ "style": "电影感很强的高级画面" }
```

问题：style 应该是媒介 / 笔触 / 美学锚定；mood 应该是情绪基调。分开：

- style: "胶片摄影、暖色调、浅景深"
- mood: "安静、私密、疲惫但温暖"

### 反例 D：subject 复述参考图

启用角色时：

```json
{ "subject": "这位银发年轻女性，身穿黑色皮夹克，红色眼瞳，身材纤细..." }
```

问题：角色外形已在参考图，brief 中不应重复。改为：

```json
{ "subject": "角色参考图中的人物（身份已提供）" }
```

finalPrompt 中只写该角色在本次画面中的具体表现。

## 4. Agent 追问示例

用户输入模糊时，Agent 应精准追问：

- 用户的"想要好看的人物图" → "想要哪种风格的人像？写实摄影 / 插画 / 二次元？整体氛围偏明亮还是暗调？"
- 用户的"画一个城市" → "哪个城市？白天还是夜晚？俯瞰还是街道视角？有没有特定地标？"

避免一次问多个问题。

## 5. finalPrompt 长度

`buildIllustrationPrompt` 把 finalPrompt 嵌入 gpt-image-2 prompt。APIMart 端 max 总长度有上限。本项目 `MAX_PROMPT_LENGTH` 约为 20,000 字符，因此 finalPrompt 控制在 200~~500 词（中文约 400~~1000 字）最稳。超过 800 字往往会触发模型裁剪。

## 6. 何时升级为高质量

若画面含密集文字 / 信息图 / 数据可视化，UI 界面应让用户选 `quality=high`。本 prompt 不写入 quality 参数。

## 7. 跨 brief 复用原则

brief 8 字段中：

- 同一角色在多张插画中 → subject 字段保持稳定（"角色参考图中的人物"），只改其他字段
- 同一画风系列 → style 字段保持稳定
- 同一世界观 → environment 和 mood 字段保持风格一致

让 Agent 在用户没说"换风格"时不要主动漂移。
