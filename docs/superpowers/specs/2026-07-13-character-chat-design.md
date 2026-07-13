# 多轮对话生成 IP 角色设定（character chat）

- **日期**：2026-07-13
- **状态**：draft — 待用户 review
- **范围**：`src/views/character/` + `src-tauri/src/gacha/character_chat.rs`（新文件）+ 一条 store；写卡 / 抽卡 / 策略 / 设置模块**不动**

## 1. 问题与目标

「角色」页现在是一个 TipTap 富文本编辑器，直接读写 `ip.md`。经验上，自己动手从头写一个 IP 角色设定对大多数用户来说门槛太高——脑子里有一个形象但落到文字上就卡住了。

目标：在「角色」页加一个多轮对话 tab，让 DeepSeek 扮演「半主动引导型搭档」，一句一句把用户心里的角色挖出来；用户随时点「让 DeepSeek 总结」就能拿到一份符合 ip.md 结构的初稿，预览后送回 TipTap 编辑器，未保存状态显示给用户。

## 2. 决策记录（已与用户对齐）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 多轮怎么收尾 | 用户随时点「让 DeepSeek 总结」 |
| 2 | 与现有编辑器的关系 | 「对话」/「手写」两个 tab 切换，不同时占屏 |
| 3 | 对话状态保留 | 纯内存，跨 tab 切换不丢，app 重启清空 |
| 4 | DeepSeek 说话方式 | 半主动引导型搭档；一次只问一件事，问完等用户答 |
| 5 | 总结 ↔ 写盘衔接 | 总结以 Markdown 预览呈现，「保存到 ip.md」按钮切回 TipTap dirty 草稿态 |
| 6 | 现存 ip.md 与对话 | 进入对话 tab 时，总是把磁盘上 ip.md 嵌入对话 system prompt |
| 7 | 方案 | 新增 Rust 命令 `chat_ip` + `summarize_ip`，不动 `generate_prompt` |
| 8 | 事件命名 | 复用现有 `deepseek://delta`，payload 增加 `mode` + `request_id` 字段 |

## 3. 架构

### 3.1 顶层数据流

```
[对话] tab 进入
  └─ chat store: snapshotIp = project.read_context().ip  (一次性, store 缓存)
              push 占位 user/assistant 消息不发生；只等 DeepSeek system prompt 主动开场

[用户发消息]
  └─ sendUserMessage(text)
       └─ push role=user；push 占位 role=assistant（id 当 request_id）
       └─ invoke('chat_ip', { req: { root, history, model, request_id } })
            └─ Rust: project::read_context → build_chat_messages → stream_chat
                 on_delta → app.emit("deepseek://delta",
                     DeepSeekDelta { content, reasoning, mode="chat", request_id })
            └─ 前端 listen('deepseek://delta', ...) 按 mode + request_id 过滤，
                 把 content/reasoning 累加到对应 assistant 占位消息

[用户点"让 DeepSeek 总结"]
  └─ summarize()
       └─ phase = 'summarizing'
       └─ invoke('summarize_ip', { req: { root, history, model, request_id } })
            └─ Rust: project::read_context → build_summary_messages → stream_chat
                 on_delta → emit DeepSeekDelta { content, reasoning, mode="summary", request_id }
            └─ 流结束后 phase = 'preview'

[预览]
  └─ Markdown 渲染（用现有 markdown-renderer.vue，只读）
  └─ 取消按钮：phase → 'idle'，总结消息留在历史里
  └─ 保存到 ip.md 按钮（acceptSummary）：
       └─ context.set('ip', summaryText)（Pinia store 同步写引用，不写盘）
       └─ chat-tab emits `accepted`
       └─ character/index.vue 把 active tab 切到「手写」
       └─ TipTap watch(content) → syncFromExternal() → dirty=true → 「未保存」提示
       └─ toast：「已送到手写页，按顶部「保存」键写盘」
       └─ phase = 'idle'
```

### 3.2 文件改动清单

**新增**
- `src-tauri/src/gacha/character_chat.rs` —— 纯函数：`CHAT_SYSTEM_PROMPT` 常量、`SUMMARY_SYSTEM_PROMPT` 常量、`build_chat_messages`、`build_summary_messages`、`build_chat_payload`、`build_summary_payload`（后两个拼 messages + temperature + stream 并返回 serde_json::Value）。
- `src/stores/chat.ts` —— Pinia store，详见 §5。
- `src/views/character/components/chat-tab.vue` —— 主对话界面。
- `src/views/character/components/chat-summary-preview.vue` —— 总结 Markdown 预览面板。
- `tests/character_chat.rs`（在 `src-tauri/tests/`）—— Rust 单测，详见 §6。

**修改**
- `src-tauri/src/gacha/mod.rs` —— 注册 `chat_ip` 与 `summarize_ip` 两个 `#[tauri::command]`；`DeepSeekDelta` 加 `mode` + `request_id` 两个字段（用 `#[serde(default)]` 保证向后兼容）。
- `src/views/character/index.vue` —— 从单文件变 tab 容器，默认激活「手写」。

**完全不动**
- `src-tauri/src/gacha/deepseek.rs` 全部（含单测）—— `stream_chat`、`build_messages`、`build_payload`、`strip_fences`、`parse_sse_data` 一行不改。
- `src-tauri/src/gacha/project.rs` 全部（含单测）。
- `src/components/context-editor.vue` 不变；仍由「手写」tab 渲染。
- `src/stores/context.ts` 不变；复用其 `set('ip', text)` 和 `save(root, kind, text)`。
- `src/stores/writer.ts` 与写卡全部路径不变——新 `DeepSeekDelta.mode` 字段对它透明。
- `src/views/{writer,gacha,strategy,settings}/` 全部不变。

### 3.3 关键不变量

1. **`ip.md` 只在用户主动点保存时落盘**：无论对话生成多少、预览多少次，磁盘上的 `ip.md` 文件不被动。直到用户在「手写」tab 按下「保存」键（沿用现有 `write_context` 命令）才写盘。
2. **同一时间只有一个真相（single source of truth）**：TipTap editor 和 ChatTab 共享 `useContextStore.ip` 引用。context.set('ip', summaryText) 让两边同步，不引入第二份存储。
3. **写卡 / 抽卡 路径完全隔离**：writer 既不感知 chat 也不感知 summary；新事件 `deepseek://delta` payload 是加法，向后兼容。

## 4. 系统提示词（system prompts）

两段字符串作为 `character_chat.rs` 里的 `pub const`。格式参考 `deepseek::build_messages` 的拼装风格以保持一致。

### 4.1 `CHAT_SYSTEM_PROMPT`

```
你是「{project_label}」这个 IP 的角色设计伙伴。用户在脑子里有一个角色但说不清楚，你要帮他一句一句问清楚。

你看到下面这段 ip.md（如果存在）是项目里已有的角色设定。你可以基于这个设定继续聊，也可以协助从零开始。

# 你该怎么说话
- 一次只问一件事。问完等用户回答再问下一个。
- 优先问"反差点"——能让人记住这个角色的地方。
  （具体关注点：叫什么 / 内心自我认知 / 在作品里该演什么样的时刻 / 什么样的时刻绝对不让他演 / 长相识别锚点 / 说话的口吻）
- 用户回到口吃 / "我也不知道" / 跳过答案时——不要连问三个下一个，用一句"那我们换一个方向，先 X"。
- 用户补充主动信息，不要拦截，照常推进。

# 硬约束
- 不要描述角色的脸、发色、身材、衣服——这些是定妆照干的，不是文字干的事。
- 不要带 markdown 代码块（聊天模式输出只接受纯文本 + 句中断行）。
- 总结模式才出 ip.md 文稿；聊天模式只说话。

# 当前的 ip.md（你看到的仅仅是快照）
{ip_md_or_empty}
```

### 4.2 `SUMMARY_SYSTEM_PROMPT`

```
你是 IP 角色设定书的下笔人。根据你和用户从 {n_turns} 轮对话中得到的信息，按以下结构整理出一份 ip.md。

# 结构
1. 他是谁。给一个名字（或者代号）、一句概括他是「什么人」、一个引起阅读欲的排比或名字原因。
2. 识别锚点。列出 3–5 条「只能是他 / 不这样就不会被别人记住」的视觉 / 人物描述锚点。
3. 三个表演工具。三个他通用的「句子」——什么身份、住在什么境地、做什么事。
4. 禁区。两个他不能被拿走的点。

# 输出要求
- 用 markdown 文档。
- 不要代码围栏。
- 不要「以下是 ip.md」之类开场白。
- 不要「希望你喜欢」之类收尾。
- 不要重复用户说过的话，只纯化、对齐、添加不可以。

# 完整对话
{transcript}

# 现存的 ip.md（仅参考，不是你的依据；如果与对话冲突从对话）
{ip_md_or_empty}
```

### 4.3 温度与流式参数

| 调用 | temperature | stream | 模型 |
|---|---|---|---|
| `chat_ip` | `deepseek::TEMPERATURE`（1.3） | `true` | `app.settings.deepseekModel` |
| `summarize_ip` | `0.7`（硬绑，常量 `SUMMARY_TEMPERATURE`） | `true` | `app.settings.deepseekModel` |

聊天温度沿用现有 1.3；总结温度降到 0.7 让它贴模板而非自由发挥。两个都走 `deepseek::stream_chat`，复用 SSE + UTF-8 保护。

## 5. 数据模型与前端 store

### 5.1 Rust 端：`DeepSeekDelta` 字段扩展

```rust
#[derive(Debug, Clone, Serialize)]
pub struct DeepSeekDelta {
    pub content: String,
    pub reasoning: String,
    #[serde(default)]    // 旧调用者 (writer) 不写也合法
    pub mode: String,    // "prompt" | "chat" | "summary"
    #[serde(default)]
    pub request_id: String,
}
```

`request_id` **由前端生成并随 invoke 传入**（详见 §5.2）。Rust 端三个命令的 request 参数都补一个可选的 `request_id: Option<String>`（`#[serde(default)]`），生成逻辑在各自命令里：

- `generate_prompt`：前端调用时**不传** request_id，Rust 端 `let request_id = req.request_id.unwrap_or_default()`——空串。writer 端不读 `pendingRequestId`，对空串自然 fail 路由过滤，落不到状态。
- `chat_ip` / `summarize_ip`：前端用 `nanoid()` 把即将推送的 assistant 占位消息 id 作为 `request_id` 传入；Rust 原样回填到每次 `emit`。

不引入 `uuid` 依赖；前端已有 `nanoid` 满足。

### 5.2 Pinia store `useChatStore`

```typescript
type ChatRole = 'user' | 'assistant';
type ChatPhase =
  | 'idle'             // 静止
  | 'streaming-chat'   // 用户发了问题，DeepSeek 还在流式回
  | 'summarizing'      // 用户点了"总结"，DeepSeek 还在写 ip.md
  | 'preview';         // 总结流结束，等用户决定保存还是取消
```

interface ChatMessage {
  id: string;          // nanoid；同时充当 request_id
  role: ChatRole;
  content: string;     // 已 stream 完成 / 正在 stream 累加
  reasoning: string;   // reasoner 才会有；chat 模型恒空串
  createdAt: number;
  failed?: boolean;    // 出错时置 true，content 替换为 "[error: ...]"
}

interface SnapshotIp {
  capturedAt: number;
  content: string;
}

const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([]);
  const phase = ref<ChatPhase>('idle');
  const lastError = ref('');
  const snapshotIp = ref<SnapshotIp | null>(null);
  const pendingRequestId = ref('');  // 当前正在流的回合 id

  function enterChat(root: string) {
    if (snapshotIp.value) { return; }  // 已有会话，保留
    // 调 project.read_context 抓 ip.md（直接 invoke，不走 useContextStore）
    // snapshotIp.value = { capturedAt: Date.now(), content: ... };
  }

  async function sendUserMessage(text: string, root: string, model: string) {
    const userId = nanoid();
    const assistantId = nanoid();
    messages.value.push({ id: userId, role: 'user', content: text, reasoning: '', createdAt: Date.now() });
    messages.value.push({ id: assistantId, role: 'assistant', content: '', reasoning: '', createdAt: Date.now() });
    phase.value = 'streaming-chat';
    pendingRequestId.value = assistantId;
    // history = messages.value.map(m => ({ role: m.role, content: m.content }))
    //   然后再 push 一条 { role: 'user', content: text } 当作本轮新问题
    const history = [...messages.value.map(m => ({ role: m.role, content: m.content })),
                     { role: 'user', content: text }];
    await invoke('chat_ip', { req: { root, history, model, request_id: assistantId } });
  }

  async function summarize(root: string, model: string) {
    const summaryId = nanoid();
    messages.value.push({ id: summaryId, role: 'assistant', content: '', reasoning: '', createdAt: Date.now() });
    phase.value = 'summarizing';
    pendingRequestId.value = summaryId;
    // summary 复用整个 messages 历史（包括刚推的 summaryId 占位 assistant）
    const history = messages.value.map(m => ({ role: m.role, content: m.content }));
    await invoke('summarize_ip', { req: { root, history, model, request_id: summaryId } });
    phase.value = 'preview';
  }

  function cancelPreview() { phase.value = 'idle'; }

  function acceptSummary() {
    // 只在 phase==='preview' 下生效；不写盘，只更新 Pinia 引用，由 TipTap watch 渲染为 dirty 草稿
    const target = messages.value[messages.value.length - 1];
    if (!target || target.role !== 'assistant' || phase.value !== 'preview') { return; }
    useContextStore().set('ip', target.content);
    phase.value = 'idle';
    // 调用方（chat-tab.vue）负责 emit `accepted` 给 character/index.vue，后者切换 active tab
  }

  function resetSession() {
    messages.value = [];
    phase.value = 'idle';
    lastError.value = '';
    snapshotIp.value = null;
    pendingRequestId.value = '';
  }

  // listen('deepseek://delta') 的回调：按 mode + request_id 路由
  function onDelta(delta: DeepSeekDelta) {
    if (delta.mode !== 'chat' && delta.mode !== 'summary') { return; }  // 屏蔽 prompt 模式
    if (delta.request_id !== pendingRequestId.value) { return; }
    const target = messages.value.find(m => m.id === delta.request_id);
    if (!target) { return; }
    if (delta.content) { target.content += delta.content; }
    if (delta.reasoning) { target.reasoning += delta.reasoning; }
  }

  return { messages, phase, lastError, snapshotIp,
           enterChat, sendUserMessage, summarize,
           cancelPreview, acceptSummary, resetSession, onDelta };
});
```

不变量：
1. **跨 tab 不丢**——Pinia 跨路由活着，`enterChat` 的 idempotent guard 让用户从「对话」切到「手写」再切回来消息还在。
2. **app 重启清空**——纯内存。
3. **`role: 'system'` 永不在 messages 数组**——system 是 Rust 端拼的，前端不持有。
4. **delta 路由**——`(event.payload.mode === 'chat' 或 'summary') && event.payload.request_id === pendingRequestId.value` 才累加。
5. **每次 invoke 发全 history**——DeepSeek chat 是 stateless，取所有 user/assistant 偶对传给后端。

## 6. UI 交互流程

### 6.1 整页布局

```
character/index.vue:
  ┌──────────────────────────────────────────────────────────┐
  │  [手写]  [对话]                ← shadcn-vue Tabs         │
  ├──────────────────────────────────────────────────────────┤
  │         <ContextEditor />   或   <ChatTab />              │
  └──────────────────────────────────────────────────────────┘
```

默认激活「手写」。Tab 切换不卸载组件（`v-show` 行为，由 shadcn-vue 的 `Tabs` 控件默认实现）。

### 6.2 「对话」tab 内部

```
┌──────────────────────────────────────────────────────────┐
│  <Avatar/> <项目名> 的 IP 助手  [让 DeepSeek 总结] [新会话]│
├──────────────────────────────────────────────────────────┤
│  <ai-elements/Conversation>                                │
│     [assistant] 你好！介绍一下这位角色吧？                  │
│     [user]      ...                                        │
│     [assistant] 他叫什么？                                  │
│     [user]      ...                                        │
│     [assistant▸ reasoning 折叠] ...他叫阿九 [shimmer]      │
│                                                          │
│  ┌─ PreviewSheet (仅 phase==='preview') ──┐             │
│  │  DeepSeek 写出来的 ip.md 预览            │             │
│  │  ── markdown-renderer (只读) ──          │             │
│  │  [取消]                  [保存到 ip.md]   │             │
│  └──────────────────────────────────────────┘             │
├──────────────────────────────────────────────────────────┤
│  <PromptInput>                                            │
│     [textarea]                              [➤ 发送]      │
│     Enter 发送 / Shift+Enter 换行                          │
├──────────────────────────────────────────────────────────┤
│  ⚠ 网络挂了 / DeepSeek 报 4xx              (错误条)         │
└──────────────────────────────────────────────────────────┘
```

### 6.3 操作矩阵

| 操作 | 条件 | 行为 |
|---|---|---|
| 进入「对话」tab | snapshotIp === null | enterChat(root) 抓 disk 上的 ip.md；不主动发请求，等 DeepSeek 系统提示词开场 |
| 再次进入 | snapshotIp !== null | 消息全在，无动作 |
| 点发送 | phase==='idle' + 文本非空 | sendUserMessage，phase→'streaming-chat' |
| 流式发送中 | phase 流式中 | PromptInput disable；Ctrl+Enter 也禁用；流结束 phase→'idle' |
| 流中断 / 网络挂 | invoke throw | lastError 设值；占位 assistant 标 failed='[error: ...]'；phase→'idle' |
| 点「让 DeepSeek 总结」 | phase==='idle' + messages 中 assistant 数 ≥ 1 | summarize，phase→'summarizing' → 流结束 → phase→'preview' |
| 取消正在进行的流 | phase 流式中 | **无按钮**（见 YAGNI §8.1） |
| 预览点取消 | phase==='preview' | phase→'idle'；总结消息留在历史里 |
| 预览点保存 | phase==='preview' | acceptSummary：context.set('ip', summaryText)；chat-tab emit `accepted`；index.vue 切到「手写」tab；phase→'idle' |
| 「手写」tab 保存 | dirty==true | 走现有 write_context；context.ip 更新；chat 不重置（snapshotIp 保持抓取时的旧值） |
| 点「新会话」 | 总可点 | AlertDialog 二次确认 → resetSession() → snapshotIp=null |
| 错误反馈 | lastError 非空 | inline 错误条（与 context-editor.vue 的 lastError 风格一致）+ toast；不引入新组件 |

### 6.4 ai-elements 使用清单

- `Conversation` / `ConversationContent`：消息列表滚动容器
- `ConversationScrollButton`：滚到底按钮
- `Message` / `MessageContent` / `MessageResponse`：单条消息渲染（用户消息用纯文本，助手消息用 markdown-renderer）
- `PromptInput` / `PromptInputBody` / `PromptInputTextarea` / `PromptInputSubmit`：底栏输入
- `Reasoning` / `ChainOfThought`：reasoner 折叠区（chat 模型时不渲染）

## 7. 错误处理

| 触发 | UI | 系统 |
|---|---|---|
| `gacha.projectRoot === ''` | 全屏提示「先去「设置」里选项目目录」 | ChatTab 不渲染 |
| `project.has_deepseek_key === false` | 顶部红条「还没配 DeepSeek key，去「设置」里加」+ PromptInput disable | 不发请求 |
| 用户发空白 | 发送按钮 disable | 不发请求 |
| assistant 数 === 0 时点总结 | 总结按钮 disable | 不发请求 |
| DeepSeek HTTP 4xx | toast「DeepSeek HTTP 401: ...」 | lastError；phase→'idle'；占位 assistant 标 failed |
| DeepSeek HTTP 5xx / 网络断 | toast「网络挂了 / DeepSeek 不可达：<原因>」 | 同上 |
| SSE 流末尾 EOF 无 `[DONE]` | 最后气泡「⚠ 回复中断（截至目前为止）」 | stream_chat 自然返回累积内容；不标 failed |
| 预览→「手写」后的实际写盘失败 | toast + 「手写」tab footer 红字 | 由 context-editor.vue 现有 lastError 路径处理，本 spec 不引入新逻辑 |
| chat 输入超过 context 上限 | 不拦截 | 走 4xx 路径 |

## 8. YAGNI（明确不做）

1. 不中断正在流的请求——Rust 没接 CancelToken、前端也没这层。
2. 不存档对话到磁盘——纯内存、session-only。
3. 不自动压缩 history——相信 deepseek-chat 的 context 上限。
4. 不允许对话接受图片输入——DeepSeek 不看图（README 硬约束）。
5. 不替代写卡的 system prompt 拼装——`generate_prompt` / `build_messages` 不动。
6. 不做 i18n——全中文。
7. 不支持多会话并存——一次只有一个 snapshotIp + messages。
8. 不做 token 估算前端拦截——交给 DeepSeek 4xx。
9. 不为 character chat 单独搞 DeepSeek 模型选择——复用 `app.settings.deepseekModel`。
10. 不自动开启 `deepseek-reasoner`——沿用用户在「设置」里的选择。
11. 不改 `AGENTS.md` 的编辑流程——「策略」tab 一行不动。
12. 不做 pair-programmer 体验（让 DeepSeek 一次问多个问题）——system prompt 已约束"一次只问一件事"。
13. 不做 preview 阶段的 diff 视图——交给 TipTap dirty 草稿对比。
14. 不加 vitest——e2e 手工 checklist。

## 9. 测试策略

### 9.1 Rust 单测（`tests/character_chat.rs`）

- `build_chat_messages`：
  - 消息数 == 1 system + history 长度 + 1 user
  - 第一条 role='system'，含 "ip.md" 字面、history 中每条 user/assistant 内容拼入
  - 末尾 user 与传入的最后一条 user_msg 精确相等
  - history 为空时 messages 长度 == 2
- `build_summary_messages`：
  - 消息数 == 1 system + transcript 长度（user/assistant 偶对，外部保证）
  - system 含 "ip.md" 字面、含 transcript 内容
- `build_summary_payload`：
  - `body["temperature"]` == 0.7
  - `body["stream"]` == true
  - `body["model"]` == 传入 model
- `build_chat_payload`：
  - `body["temperature"]` == 1.3（`deepseek::TEMPERATURE`）
  - 其余同上

### 9.2 不动的测试

- `deepseek.rs` 全部 8 个单测保持不变不动；本 spec 不动 `stream_chat` / `build_messages` / `build_payload` / `strip_fences` / `parse_sse_data`。
- `project.rs` 全部单测保持不变。
- `mod.rs` 的 Tauri 命令不进单测（要 `AppHandle`，靠手测）。

### 9.3 前端 e2e 手工 checklist（无 vitest）

1. 清空 DeepSeek key → 进「对话」tab → 红条「还没配 key」
2. 没 key → 总结按钮 disable、PromptInput disable
3. 进「对话」tab → 等 DeepSeek 主动开场 → 用户输入 → 看流式回 → reasoning 区折叠
4. 3 轮对话 → 点「让 DeepSeek 总结」→ preview 出现 → markdown 渲染
5. 预览点「保存到 ip.md」→ 切「手写」tab → TipTap 未保存 → 按「保存」 → 磁盘 ip.md 更新
6. 回到「对话」tab → 历史还在
7. 点「新会话」二次确认 → 清空
8. 模拟 4xx（改 key 加错尾字符）→ 看 toast + lastError + 占位 [error]
9. 「手写」tab 改 ip.md → 再切「对话」tab → snapshotIp 仍是抓取时的旧值（不会自动 reload）

## 10. 验收口径

PR 通过标准：
1. `cargo test`（在 `src-tauri/` 下）全绿；新增的 `character_chat` 测试 ≥ 6 条全过；**未删 / 未改任何已有测试**
2. `pnpm build` 全绿
3. `pnpm lint:eslint` 无新增 warning
4. §9.3 e2e checklist 9 条手测全过
5. `cargo build` 在 Tauri 桌面 app 里启动正常，「角色」页 [手写]/[对话] 两个 tab 都能进
