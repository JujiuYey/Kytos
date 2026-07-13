# Character Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 「对话」tab to `src/views/character/` that drives multi-turn DeepSeek conversation to help users craft their `ip.md`, with the result landing in the existing 「手写」TipTap editor as a dirty draft.

**Architecture:** Two new Tauri commands (`chat_ip`, `summarize_ip`) in Rust call `deepseek::stream_chat` with different system prompts. The frontend pins `app.settings.deepseekModel`, generates `nanoid()` request IDs, listens to the existing `deepseek://delta` event filtered by new `mode` + `request_id` fields, and renders with the existing shadcn-vue + ai-elements UI. State lives in a fresh `useChatStore` Pinia store (memory-only).

**Tech Stack:** Tauri 2 + Rust (`serde_json`, `reqwest` via existing `deepseek` module), Vue 3 + Pinia, shadcn-vue (`Tabs` from `src/components/ui/tabs`), ai-elements (`Conversation` / `Message` / `PromptInput` / `Reasoning` from `src/components/ai-elements/...`, manually imported).

---

## Notes for implementers

- **Pure functions stay pure.** `character_chat.rs` only deals with `serde_json::Value` arrays / strings. No I/O, no `reqwest`, no `tokio`. Keeps it testable.
- **No `uuid` dep.** Frontend sends `request_id` (a `nanoid()` string). Rust echoes it back. Existing code stays untouched.
- **Auto-import is selective.** `src/components/ui/*` is auto-imported (per `vite.config.ts:50-57`). `src/components/ai-elements/*` and `src/components/markdown-renderer.vue` are **not**; `import` them explicitly.
- **Inline `mod tests`, not integration tests.** Pure function tests in Rust live inside the source file as `#[cfg(test)] mod tests`, matching `deepseek.rs`. This deviates from `docs/.../spec-...md` which mentioned `tests/character_chat.rs`; the change is intentional for consistency with how `deepseek.rs` and `project.rs` test pure logic.
- **`window.confirm` is allowed.** Existing `context-editor.vue:116` uses `window.prompt` for link input. New 「新会话」 uses `window.confirm` to match.
- **Tabs default to 「手写」** and never auto-switch. Only user-triggered tab changes via click or `accepted` event.
- **No new dependencies.** All UI exists in the tree already.

---

## Phase 1 — Rust foundation (pure functions, TDD)

### Task 1: Extend `DeepSeekDelta` with `mode` + `request_id`

**Files:**
- Modify: `src-tauri/src/gacha/mod.rs:312-317`

- [ ] **Step 1: Open `src-tauri/src/gacha/mod.rs` and update the `DeepSeekDelta` struct**

Replace lines 312–317:

```rust
/// Payload sent to the frontend over `deepseek://delta`.
#[derive(Debug, Clone, Serialize)]
pub struct DeepSeekDelta {
    pub content: String,
    pub reasoning: String,
}
```

with:

```rust
/// Payload sent to the frontend over `deepseek://delta`.
///
/// `mode` discriminates the kind of generation: `"prompt"` for writer's
/// one-shot prompt generation, `"chat"` and `"summary"` for the new
/// 「角色」conversation tab. `request_id` is a per-round identifier the
/// frontend generates and uses to route streaming deltas to the right
/// assistant placeholder message. Writer doesn't read it; serde defaults
/// keep `#[serde(default)]` for forward compatibility.
#[derive(Debug, Clone, Serialize)]
pub struct DeepSeekDelta {
    pub content: String,
    pub reasoning: String,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub request_id: String,
}
```

- [ ] **Step 2: Update the existing `generate_prompt` emit closure to fill the new fields**

Find the `DeepSeekDelta { content: ..., reasoning: ... }` constructor inside `generate_prompt`'s `on_delta` closure (around `mod.rs:402-410`). It currently constructs named fields without `..Default::default()`, so adding new fields would break compile. Set both new fields explicitly here:

```rust
            let _ = app_for_emit.emit(
                "deepseek://delta",
                DeepSeekDelta {
                    content: delta.content,
                    reasoning: delta.reasoning,
                    mode: "prompt".to_string(),
                    request_id: String::new(),
                },
            );
```

Writer's frontend (`stores/writer.ts`) doesn't read `mode` or `request_id`, so emitting `mode="prompt"` and `request_id=""` is purely additive. The empty `request_id` is fine — the writer never sets `pendingRequestId`, so its chat-store-style delta filter (added in Task 5) would naturally drop those events if it ever listened.

- [ ] **Step 3: Build to confirm the struct change + call site compiles**

Run: `cd src-tauri && cargo build --lib`
Expected: build succeeds, no warnings on the struct.

- [ ] **Step 4: Run the existing test suite — must stay green**

Run: `cd src-tauri && cargo test --lib -- --quiet`
Expected: All existing deepseek.rs / project.rs tests pass. New fields default to empty strings; no test asserts on `DeepSeekDelta` directly.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/gacha/mod.rs
git commit -m "feat(deepseek): extend DeepSeekDelta with mode + request_id (defaults to empty)"
```

---

### Task 2: TDD `build_chat_messages`

**Files:**
- Create: `src-tauri/src/gacha/character_chat.rs`
- Modify: `src-tauri/src/gacha/mod.rs` (add `pub mod character_chat;`)

- [ ] **Step 1: Register the new module**

In `src-tauri/src/gacha/mod.rs`, add `pub mod character_chat;` to the existing module decl block (lines 13–16). The block should become:

```rust
pub mod apimart;
pub mod character_chat;
pub mod deepseek;
pub mod error;
pub mod project;
```

- [ ] **Step 2: Create `src-tauri/src/gacha/character_chat.rs` with only the failing test mod**

```rust
//! Pure builders for the 「角色」conversation tab. Reuses `deepseek::stream_chat`
//! for SSE — we only own the system prompts and message array shapes.
//! Kept I/O-free so unit tests run instantly.

use serde_json::{json, Value};

use crate::gacha::deepseek;

/// Temperature for the chat (multi-turn conversation) flow.
pub const CHAT_TEMPERATURE: f32 = deepseek::TEMPERATURE;

/// Build the system + history + user messages for a chat round.
///
/// `ip_md` is the current disk snapshot (may be empty). `history` is the
/// sequence of prior user/assistant turns in this session, oldest first.
/// `user_msg` is the new question the user just submitted.
///
/// Returns a flat `Vec<Value>` suitable for `deepseek::build_payload`'s
/// `messages` argument. The system prompt embeds `CHAT_SYSTEM_PROMPT`
/// with `{project_label}` and `{ip_md_or_empty}` substituted in.
pub fn build_chat_messages(
    project_label: &str,
    ip_md: &str,
    history: &[(String, String)],
    user_msg: &str,
) -> Vec<Value> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn last_system(messages: &[Value]) -> &str {
        messages
            .iter()
            .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("system"))
            .and_then(|m| m.get("content").and_then(|c| c.as_str()))
            .expect("system message present")
    }

    #[test]
    fn build_chat_messages_with_empty_history_has_2_messages() {
        let msgs = build_chat_messages("阿九", "", &[], "你好");
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0]["role"], "system");
        assert_eq!(msgs[1]["role"], "user");
        assert_eq!(msgs[1]["content"], "你好");
    }

    #[test]
    fn build_chat_messages_system_embeds_project_label_and_ip_md() {
        let msgs = build_chat_messages(
            "阿九的 IP",
            "他叫阿九，住在一个叫九巷的胡同里。",
            &[],
            "他应该演什么？",
        );
        let sys = last_system(&msgs);
        assert!(sys.contains("阿九的 IP"), "project label interpolated");
        assert!(sys.contains("他叫阿九"), "ip.md verbatim interpolated");
    }

    #[test]
    fn build_chat_messages_appends_history_in_order_then_new_user() {
        let history = vec![
            ("user".to_string(), "他叫什么？".to_string()),
            ("assistant".to_string(), "叫阿九。".to_string()),
        ];
        let msgs = build_chat_messages("阿九", "ip content", &history, "他住哪？");
        // 1 system + 2 history + 1 new user = 4
        assert_eq!(msgs.len(), 4);
        assert_eq!(msgs[1]["role"], "user");
        assert_eq!(msgs[1]["content"], "他叫什么？");
        assert_eq!(msgs[2]["role"], "assistant");
        assert_eq!(msgs[2]["content"], "叫阿九。");
        assert_eq!(msgs[3]["role"], "user");
        assert_eq!(msgs[3]["content"], "他住哪？");
    }

    #[test]
    fn build_chat_messages_empty_ip_md_renders_marker() {
        let msgs = build_chat_messages("p", "", &[], "从零开始");
        let sys = last_system(&msgs);
        assert!(sys.contains("（空 — 还没有 ip.md）") || sys.contains("（空"), "empty ip.md labeled in system prompt");
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-tauri && cargo test --lib gacha::character_chat -- --quiet`
Expected: 4 failing tests, all with `not yet implemented` (from `todo!()`).

- [ ] **Step 4: Implement `build_chat_messages`**

Replace the `todo!()` body with:

```rust
pub fn build_chat_messages(
    project_label: &str,
    ip_md: &str,
    history: &[(String, String)],
    user_msg: &str,
) -> Vec<Value> {
    let ip_md_substituted = if ip_md.trim().is_empty() {
        "（空 — 还没有 ip.md）".to_string()
    } else {
        ip_md.to_string()
    };
    let system = format!(
        "你是「{project_label}」这个 IP 的角色设计伙伴。用户在脑子里有一个角色但说不清楚，你要帮他一句一句问清楚。\n\n\
         你看到下面这段 ip.md（如果存在）是项目里已有的角色设定。你可以基于这个设定继续聊，也可以协助从零开始。\n\n\
         # 你该怎么说话\n\
         - 一次只问一件事。问完等用户回答再问下一个。\n\
         - 优先问\"反差点\"——能让人记住这个角色的地方。\n\
           （具体关注点：叫什么 / 内心自我认知 / 在作品里该演什么样的时刻 / 什么样的时刻绝对不让他演 / 长相识别锚点 / 说话的口吻）\n\
         - 用户回到口吃 / \"我也不知道\" / 跳过答案时——不要连问三个下一个，用一句\"那我们换一个方向，先 X\"。\n\
         - 用户补充主动信息，不要拦截，照常推进。\n\n\
         # 硬约束\n\
         - 不要描述角色的脸、发色、身材、衣服——这些是定妆照干的，不是文字干的事。\n\
         - 不要带 markdown 代码块（聊天模式输出只接受纯文本 + 句中断行）。\n\
         - 总结模式才出 ip.md 文稿；聊天模式只说话。\n\n\
         # 当前的 ip.md（你看到的仅仅是快照）\n\
         {ip_md_substituted}",
    );

    let mut messages: Vec<Value> = vec![json!({ "role": "system", "content": system })];
    for (role, content) in history {
        messages.push(json!({ "role": role, "content": content }));
    }
    messages.push(json!({ "role": "user", "content": user_msg }));
    messages
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib gacha::character_chat -- --quiet`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/gacha/character_chat.rs src-tauri/src/gacha/mod.rs
git commit -m "feat(character_chat): TDD build_chat_messages"
```

---

### Task 3: TDD `build_summary_messages` + payload builders

**Files:**
- Modify: `src-tauri/src/gacha/character_chat.rs`

- [ ] **Step 1: Append failing tests for summary + payload builders**

Add inside the existing `mod tests`:

```rust
    #[test]
    fn build_summary_messages_system_specifies_structure_and_includes_transcript() {
        let transcript = vec![
            ("user".to_string(), "他叫阿九".to_string()),
            ("assistant".to_string(), "知道了。继续？".to_string()),
        ];
        let msgs = build_summary_messages("阿九", "ip content", &transcript);
        assert_eq!(msgs.len(), 1 + transcript.len());
        let sys = last_system(&msgs);
        assert!(sys.contains("ip.md"), "mentions ip.md in structure");
        assert!(sys.contains("ip content"), "existing ip.md shown");
        assert!(sys.contains("阿九"), "transcript content included verbatim");
    }

    #[test]
    fn build_chat_payload_uses_chat_temperature_and_streams() {
        let msgs = build_chat_messages("p", "", &[], "hi");
        let body = build_chat_payload("deepseek-chat", &msgs);
        assert_eq!(body["model"], "deepseek-chat");
        assert_eq!(body["stream"], true);
        let t = body["temperature"].as_f64().expect("temperature present");
        assert!((t - deepseek::TEMPERATURE as f64).abs() < 1e-6);
    }

    #[test]
    fn build_summary_payload_uses_lower_temperature_and_streams() {
        let msgs = build_summary_messages("p", "", &[]);
        let body = build_summary_payload("deepseek-chat", &msgs);
        assert_eq!(body["model"], "deepseek-chat");
        assert_eq!(body["stream"], true);
        let t = body["temperature"].as_f64().expect("temperature present");
        assert!((t - SUMMARY_TEMPERATURE as f64).abs() < 1e-6, "got {t}");
        assert!(SUMMARY_TEMPERATURE < deepseek::TEMPERATURE);
    }
```

And add stubs (with `todo!()`) at the bottom of the file:

```rust
/// Temperature for the summary flow. Lower than chat so the model sticks
/// to the structure template instead of improvising voice.
pub const SUMMARY_TEMPERATURE: f32 = 0.7;

/// Build the message array for the summary (总结) round.
///
/// `transcript` is the full chat history (user/assistant pairs, oldest
/// first). `ip_md` is the disk snapshot at the moment of summary.
/// Returned `Vec<Value>` starts with one system message and appends the
/// transcript as-is. The system prompt embeds `SUMMARY_SYSTEM_PROMPT`
/// with `{n_turns}`, `{transcript}`, and `{ip_md_or_empty}` substituted.
pub fn build_summary_messages(
    project_label: &str,
    ip_md: &str,
    transcript: &[(String, String)],
) -> Vec<Value> {
    todo!()
}

/// Wrap pre-built chat `messages` into the chat API payload JSON.
pub fn build_chat_payload(model: &str, messages: &[Value]) -> Value {
    todo!()
}

/// Wrap pre-built summary `messages` into the summary API payload JSON.
pub fn build_summary_payload(model: &str, messages: &[Value]) -> Value {
    todo!()
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test --lib gacha::character_chat -- --quiet`
Expected: 7 tests run; the 3 new ones fail with `not yet implemented`. The previous 4 still pass.

- [ ] **Step 3: Implement `build_summary_messages`**

Replace the `todo!()`:

```rust
pub fn build_summary_messages(
    project_label: &str,
    ip_md: &str,
    transcript: &[(String, String)],
) -> Vec<Value> {
    let ip_md_substituted = if ip_md.trim().is_empty() {
        "（空 — 还没有 ip.md）".to_string()
    } else {
        ip_md.to_string()
    };
    let n_turns = transcript.iter().filter(|(r, _)| r == "user").count();
    let transcript_text = transcript
        .iter()
        .map(|(role, content)| match role.as_str() {
            "user" => format!("用户：{content}"),
            "assistant" => format!("助手：{content}"),
            _ => content.clone(),
        })
        .collect::<Vec<String>>()
        .join("\n\n");

    let system = format!(
        "你是 IP 角色设定书的下笔人。根据你和用户从 {n_turns} 轮对话中得到的信息，按以下结构整理出一份 ip.md。\n\n\
         # 结构\n\
         1. 他是谁。给一个名字（或者代号）、一句概括他是「什么人」、一个引起阅读欲的排比或名字原因。\n\
         2. 识别锚点。列出 3–5 条「只能是他 / 不这样就不会被别人记住」的视觉 / 人物描述锚点。\n\
         3. 三个表演工具。三个他通用的「句子」——什么身份、住在什么境地、做什么事。\n\
         4. 禁区。两个他不能被拿走的点。\n\n\
         # 输出要求\n\
         - 用 markdown 文档。\n\
         - 不要代码围栏。\n\
         - 不要「以下是 ip.md」之类开场白。\n\
         - 不要「希望你喜欢」之类收尾。\n\
         - 不要重复用户说过的话，只纯化、对齐、添加不可以。\n\n\
         # 完整对话\n\
         {transcript_text}\n\n\
         # 现存的 ip.md（仅参考，不是你的依据；如果与对话冲突从对话）\n\
         {ip_md_substituted}\n\n\
         项目名（仅出现在 ip.md 标题以外不需要）中：{project_label}",
    );

    let mut messages: Vec<Value> = vec![json!({ "role": "system", "content": system })];
    for (role, content) in transcript {
        messages.push(json!({ "role": role, "content": content }));
    }
    messages
}
```

- [ ] **Step 4: Implement `build_chat_payload` and `build_summary_payload`**

```rust
/// Wrap pre-built chat `messages` into the chat API payload JSON.
pub fn build_chat_payload(model: &str, messages: &[Value]) -> Value {
    let mut body = json!({
        "model": model,
        "messages": messages,
        "stream": true,
        "temperature": CHAT_TEMPERATURE,
    });
    body
}

/// Wrap pre-built summary `messages` into the summary API payload JSON.
pub fn build_summary_payload(model: &str, messages: &[Value]) -> Value {
    json!({
        "model": model,
        "messages": messages,
        "stream": true,
        "temperature": SUMMARY_TEMPERATURE,
    })
}
```

- [ ] **Step 5: Run tests to verify all 7 pass**

Run: `cd src-tauri && cargo test --lib gacha::character_chat -- --quiet`
Expected: 7 tests, all PASS, no warnings.

- [ ] **Step 6: Run the full Rust test suite — must stay green**

Run: `cd src-tauri && cargo test --lib -- --quiet`
Expected: All tests pass (the new 7 plus the existing deepseek.rs/project.rs tests).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/gacha/character_chat.rs
git commit -m "feat(character_chat): TDD build_summary_messages + payload builders"
```

---

## Phase 2 — Rust Tauri commands

### Task 4: Implement `chat_ip` and `summarize_ip` commands

**Files:**
- Modify: `src-tauri/src/gacha/mod.rs`

- [ ] **Step 1: Add request types and command handlers**

Add a new section after the `GenerateResult` block (after `mod.rs:333`), before `read_context`:

```rust
/// Arguments to `chat_ip`.
#[derive(Debug, Clone, Deserialize)]
pub struct ChatIpRequest {
    pub root: String,
    /// Full chat history including the new user message as the last entry.
    /// Each item is `{"role": "user|assistant", "content": "..."}`.
    pub history: Vec<ChatMessage>,
    pub model: String,
    #[serde(default)]
    pub request_id: String,
}

/// One message in the chat history (subset of `Value` shape).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CharacterChatResult {
    pub md: String,
    pub model: String,
}

/// Stream one chat round for the 「角色」conversation tab. Mirrors
/// `generate_prompt` but routes deltas under `mode="chat"` and echoes
/// the frontend-supplied `request_id` so the UI can append to the right
/// placeholder message.
#[tauri::command]
pub async fn chat_ip(app: AppHandle, req: ChatIpRequest) -> Result<CharacterChatResult, String> {
    let outcome = chat_ip_inner(app.clone(), req).await;
    if let Err(err) = &outcome {
        let _ = app.emit(
            "deepseek://error",
            serde_json::json!({ "message": err.to_string() }),
        );
    }
    outcome.map_err(|e| e.to_string())
}

async fn chat_ip_inner(app: AppHandle, req: ChatIpRequest) -> Result<CharacterChatResult, ApiMartError> {
    let root = PathBuf::from(&req.root);
    let project_label = project_label_from_root(&root);
    let ctx = project::read_context(&root).await?;
    let api_key = deepseek::api_key_from_env()
        .or(project::read_env_key(&root, project::DEEPSEEK_API_KEY_NAME).await?)
        .ok_or_else(|| {
            ApiMartError(
                "没找到 DeepSeek key。两种办法二选一：\n  1) export DEEPSEEK_API_KEY=sk-xxx\n  2) 在项目根目录的 .env 里写一行 DEEPSEEK_API_KEY=sk-xxx".to_string(),
            )
        })?;
    let base_url = std::env::var("DEEPSEEK_BASE_URL").unwrap_or_else(|_| deepseek::DEFAULT_BASE_URL.to_string());

    let history_pairs: Vec<(String, String)> = req
        .history
        .iter()
        .take(req.history.len().saturating_sub(1))
        // Drop empty-content placeholders so DeepSeek doesn't see them as
        // a real-but-empty assistant turn. Errors are filled in by the
        // frontend into content, so a non-empty "[error: ...]" string
        // survives — that's intentional, the model can react to it.
        .filter(|m| !m.content.trim().is_empty())
        .map(|m| (m.role.clone(), m.content.clone()))
        .collect();
    let user_msg = req
        .history
        .last()
        .map(|m| m.content.clone())
        .unwrap_or_default();

    let messages = character_chat::build_chat_messages(&project_label, &ctx.ip, &history_pairs, &user_msg);
    let payload = character_chat::build_chat_payload(&req.model, &messages);

    let client = deepseek::build_http_client();
    let app_for_emit = app.clone();
    let request_id = req.request_id.clone();
    let md = deepseek::stream_chat(&client, &base_url, &api_key, &payload, move |delta| {
        let _ = app_for_emit.emit(
            "deepseek://delta",
            DeepSeekDelta {
                content: delta.content,
                reasoning: delta.reasoning,
                mode: "chat".to_string(),
                request_id: request_id.clone(),
            },
        );
    })
    .await?;

    let cleaned = deepseek::strip_fences(&md);
    Ok(CharacterChatResult { md: cleaned, model: req.model })
}

/// Read `project_label` heuristically from the project root's directory
/// name. Falls back to "IP" if the path has no usable name.
fn project_label_from_root(root: &Path) -> String {
    root.file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "IP".to_string())
}

/// Stream one summary (总结) round for the 「角色」tab. Same shape as
/// `chat_ip` but uses the summary system prompt and `mode="summary"`.
#[tauri::command]
pub async fn summarize_ip(app: AppHandle, req: ChatIpRequest) -> Result<CharacterChatResult, String> {
    let outcome = summarize_ip_inner(app.clone(), req).await;
    if let Err(err) = &outcome {
        let _ = app.emit(
            "deepseek://error",
            serde_json::json!({ "message": err.to_string() }),
        );
    }
    outcome.map_err(|e| e.to_string())
}

async fn summarize_ip_inner(app: AppHandle, req: ChatIpRequest) -> Result<CharacterChatResult, ApiMartError> {
    let root = PathBuf::from(&req.root);
    let project_label = project_label_from_root(&root);
    let ctx = project::read_context(&root).await?;
    let api_key = deepseek::api_key_from_env()
        .or(project::read_env_key(&root, project::DEEPSEEK_API_KEY_NAME).await?)
        .ok_or_else(|| {
            ApiMartError(
                "没找到 DeepSeek key。两种办法二选一：\n  1) export DEEPSEEK_API_KEY=sk-xxx\n  2) 在项目根目录的 .env 里写一行 DEEPSEEK_API_KEY=sk-xxx".to_string(),
            )
        })?;
    let base_url = std::env::var("DEEPSEEK_BASE_URL").unwrap_or_else(|_| deepseek::DEFAULT_BASE_URL.to_string());

    let transcript: Vec<(String, String)> = req
        .history
        .iter()
        // Drop the trailing empty-content placeholder assistant that the
        // frontend pushes so deltas can route to it. Without this filter
        // the transcript reads like "助手：\n\n助手：\n\n...".
        .filter(|m| !m.content.trim().is_empty())
        .map(|m| (m.role.clone(), m.content.clone()))
        .collect();

    let messages = character_chat::build_summary_messages(&project_label, &ctx.ip, &transcript);
    let payload = character_chat::build_summary_payload(&req.model, &messages);

    let client = deepseek::build_http_client();
    let app_for_emit = app.clone();
    let request_id = req.request_id.clone();
    let md = deepseek::stream_chat(&client, &base_url, &api_key, &payload, move |delta| {
        let _ = app_for_emit.emit(
            "deepseek://delta",
            DeepSeekDelta {
                content: delta.content,
                reasoning: delta.reasoning,
                mode: "summary".to_string(),
                request_id: request_id.clone(),
            },
        );
    })
    .await?;

    let cleaned = deepseek::strip_fences(&md);
    Ok(CharacterChatResult { md: cleaned, model: req.model })
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd src-tauri && cargo build --lib`
Expected: build succeeds. If `use crate::gacha::character_chat;` is not auto-imported by `mod.rs`, the `pub mod character_chat;` declaration handles that — no extra `use` needed.

- [ ] **Step 3: Confirm full Rust test suite still passes**

Run: `cd src-tauri && cargo test --lib -- --quiet`
Expected: All tests pass (7 from character_chat + existing deepseek + project tests). The new commands themselves are Tauri commands requiring an `AppHandle`, so they're not directly unit-tested; they're covered by Phase 5 e2e checklist.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/gacha/mod.rs
git commit -m "feat(gacha): chat_ip and summarize_ip tauri commands"
```

---

## Phase 3 — Frontend store

### Task 5: Skeleton `useChatStore` with types

**Files:**
- Create: `src/stores/chat.ts`

- [ ] **Step 1: Read the existing `context.ts` shape (already in your context)**

The store should match the existing style (composition API + Pinia):
- Refs: `messages`, `phase`, `lastError`, `snapshotIp`, `pendingRequestId`
- Methods: `enterChat`, `sendUserMessage`, `summarize`, `cancelPreview`, `acceptSummary`, `resetSession`, `onDelta`
- Event listener registered inside `onMounted`-equivalent (handled in Task 6).

- [ ] **Step 2: Write the full `chat.ts` skeleton with all methods and listener**

```ts
import { defineStore } from 'pinia';
import { nanoid } from 'nanoid';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useContextStore } from '@/stores/context';
import { useGachaStore } from '@/stores/gacha';
import { useAppStore } from '@/stores/app';

export type ChatRole = 'user' | 'assistant';

export type ChatPhase =
  | 'idle'
  | 'streaming-chat'
  | 'summarizing'
  | 'preview';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  reasoning: string;
  createdAt: number;
  failed?: boolean;
}

export interface SnapshotIp {
  capturedAt: number;
  content: string;
}

interface DeepSeekDeltaPayload {
  content: string;
  reasoning: string;
  mode: string;
  request_id: string;
}

interface ChatBackendMessage {
  role: string;
  content: string;
}

interface HistoryForBackend {
  history: ChatBackendMessage[];
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([]);
  const phase = ref<ChatPhase>('idle');
  const lastError = ref('');
  const snapshotIp = ref<SnapshotIp | null>(null);
  const pendingRequestId = ref('');

  let deltaUnlisten: UnlistenFn | null = null;

  async function ensureListener() {
    if (deltaUnlisten) {
      return;
    }
    deltaUnlisten = await listen<DeepSeekDeltaPayload>('deepseek://delta', event => onDelta(event.payload));
  }

  async function enterChat(root: string) {
    await ensureListener();
    if (snapshotIp.value) {
      return;
    }
    try {
      const ctx = await invoke<{ ip: string }>('read_context', { root });
      snapshotIp.value = { capturedAt: Date.now(), content: ctx.ip };
    } catch (e) {
      lastError.value = String(e);
    }
  }

  async function sendUserMessage(text: string) {
    const gacha = useGachaStore();
    const app = useAppStore();
    if (!gacha.projectRoot) {
      lastError.value = '先设置项目目录';
      return;
    }
    if (!gacha.project?.has_deepseek_key) {
      lastError.value = '还没配 DeepSeek key，去「设置」里加';
      return;
    }

    const userId = nanoid();
    const assistantId = nanoid();
    messages.value.push({ id: userId, role: 'user', content: text, reasoning: '', createdAt: Date.now() });
    messages.value.push({ id: assistantId, role: 'assistant', content: '', reasoning: '', createdAt: Date.now() });
    phase.value = 'streaming-chat';
    pendingRequestId.value = assistantId;
    lastError.value = '';

    const history: ChatBackendMessage[] = [...messages.value.map(m => ({ role: m.role, content: m.content }))];

    try {
      await invoke<unknown>('chat_ip', {
        req: {
          root: gacha.projectRoot,
          history,
          model: app.settings.deepseekModel,
          request_id: assistantId,
        },
      });
    } catch (e) {
      lastError.value = String(e);
      phase.value = 'idle';
      const target = messages.value.find(m => m.id === assistantId);
      if (target) {
        target.failed = true;
        target.content = `[error: ${String(e)}]`;
      }
    }
  }

  async function summarize() {
    const gacha = useGachaStore();
    const app = useAppStore();
    if (!gacha.projectRoot) {
      lastError.value = '先设置项目目录';
      return;
    }
    if (phase.value !== 'idle') {
      return;
    }
    if (messages.value.filter(m => m.role === 'assistant' && !m.failed).length === 0) {
      lastError.value = '聊一聊再总结';
      return;
    }

    const summaryId = nanoid();
    messages.value.push({ id: summaryId, role: 'assistant', content: '', reasoning: '', createdAt: Date.now() });
    phase.value = 'summarizing';
    pendingRequestId.value = summaryId;
    lastError.value = '';

    const history: ChatBackendMessage[] = messages.value.map(m => ({ role: m.role, content: m.content }));

    try {
      await invoke<unknown>('summarize_ip', {
        req: {
          root: gacha.projectRoot,
          history,
          model: app.settings.deepseekModel,
          request_id: summaryId,
        },
      });
      phase.value = 'preview';
    } catch (e) {
      lastError.value = String(e);
      phase.value = 'idle';
      const target = messages.value.find(m => m.id === summaryId);
      if (target) {
        target.failed = true;
        target.content = `[error: ${String(e)}]`;
      }
    }
  }

  function cancelPreview() {
    phase.value = 'idle';
  }

  function acceptSummary() {
    const target = messages.value[messages.value.length - 1];
    if (!target || target.role !== 'assistant' || phase.value !== 'preview') {
      return;
    }
    useContextStore().set('ip', target.content);
    phase.value = 'idle';
  }

  function resetSession() {
    messages.value = [];
    phase.value = 'idle';
    lastError.value = '';
    snapshotIp.value = null;
    pendingRequestId.value = '';
  }

  function onDelta(delta: DeepSeekDeltaPayload) {
    if (delta.mode !== 'chat' && delta.mode !== 'summary') {
      return;
    }
    if (!delta.request_id || delta.request_id !== pendingRequestId.value) {
      return;
    }
    const target = messages.value.find(m => m.id === delta.request_id);
    if (!target) {
      return;
    }
    if (delta.content) {
      target.content += delta.content;
    }
    if (delta.reasoning) {
      target.reasoning += delta.reasoning;
    }
    // Phase is settled by sendUserMessage / summarize when their invoke
    // resolves or throws (try/catch paths). Delta events only mutate
    // message content; they don't transition phase.
  }

  return {
    messages,
    phase,
    lastError,
    snapshotIp,
    pendingRequestId,
    enterChat,
    sendUserMessage,
    summarize,
    cancelPreview,
    acceptSummary,
    resetSession,
    onDelta,
  };
});
```

- [ ] **Step 3: Type-check the store**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.app.json`
Expected: zero errors. If the store file is included in `tsconfig.app.json` (it should be — `src/`), TS validates it.

- [ ] **Step 4: Lint the new file**

Run: `pnpm lint:eslint src/stores/chat.ts`
Expected: clean (or only auto-fixable issues that get fixed by `--fix`).

- [ ] **Step 5: Commit**

```bash
git add src/stores/chat.ts
git commit -m "feat(chat): pinia store for multi-turn character chat"
```

---

## Phase 4 — Frontend UI

### Task 6: Tab structure in `character/index.vue`

**Files:**
- Modify: `src/views/character/index.vue`
- Create: `src/views/character/components/chat-tab.vue` (skeleton only)

- [ ] **Step 1: Create the skeleton `chat-tab.vue`**

```vue
<script setup lang="ts">
const emit = defineEmits<{ (e: 'accepted'): void }>();
defineExpose({ emit });
</script>

<template>
  <div class="h-full p-6 max-w-4xl mx-auto text-sm text-muted-foreground">
    对话 tab 占位，下一步填。
  </div>
</template>
```

- [ ] **Step 2: Replace the contents of `character/index.vue` with the tab container**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useGachaStore } from '@/stores/gacha';
import { useContextStore } from '@/stores/context';
import ContextEditor from '@/components/context-editor.vue';
import ChatTab from './components/chat-tab.vue';

const project = useGachaStore();
const context = useContextStore();

const activeTab = ref<'write' | 'chat'>('write');

onMounted(async () => {
  if (project.projectRoot) {
    await context.load(project.projectRoot);
  }
});

function onAccepted() {
  activeTab.value = 'write';
}
</script>

<template>
  <Tabs v-model:value="activeTab" class="h-full">
    <TabsList class="m-2">
      <TabsTrigger value="write">
        手写
      </TabsTrigger>
      <TabsTrigger value="chat">
        对话
      </TabsTrigger>
    </TabsList>
    <TabsContent value="write" class="h-[calc(100%-3rem)] mt-0">
      <ContextEditor
        kind="ip"
        label="特征"
        helper-text="你的人物形象是谁、ta该演什么。写卡时作为 system prompt 发给 DeepSeek。"
      />
    </TabsContent>
    <TabsContent value="chat" class="h-[calc(100%-3rem)] mt-0">
      <ChatTab @accepted="onAccepted" />
    </TabsContent>
  </Tabs>
</template>
```

- [ ] **Step 3: Verify the file types and builds**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.app.json`
Expected: zero errors. `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` are auto-imported from `src/components/ui/tabs/` per `vite.config.ts:50-57`.

- [ ] **Step 4: Lint**

Run: `pnpm lint:eslint src/views/character/index.vue src/views/character/components/chat-tab.vue`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/views/character/index.vue src/views/character/components/chat-tab.vue
git commit -m "feat(character): tab container with 手写 / 对话"
```

---

### Task 7: Implement `chat-tab.vue` header + buttons

**Files:**
- Modify: `src/views/character/components/chat-tab.vue`

- [ ] **Step 1: Replace the skeleton with header + buttons**

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RefreshCw, Sparkles } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';
import { useChatStore } from '@/stores/chat';

const emit = defineEmits<{ (e: 'accepted'): void }>();

const project = useGachaStore();
const chat = useChatStore();

const projectLabel = computed(() => {
  const root = project.projectRoot;
  if (!root) {
    return 'IP';
  }
  const segs = root.split(/[\\/]/);
  return segs[segs.length - 1] || 'IP';
});

const noProject = computed(() => !project.projectRoot);
const noKey = computed(() => !project.project?.has_deepseek_key);
const assistantCount = computed(() => chat.messages.filter(m => m.role === 'assistant' && !m.failed).length);
const busy = computed(() => chat.phase === 'streaming-chat' || chat.phase === 'summarizing');

const canSummarize = computed(
  () => chat.phase === 'idle' && assistantCount.value > 0 && !noProject.value && !noKey.value,
);

onMounted(async () => {
  if (project.projectRoot) {
    await chat.enterChat(project.projectRoot);
  }
});

async function onSend(text: string) {
  await chat.sendUserMessage(text);
}

async function onSummarize() {
  await chat.summarize();
}

function onNewSession() {
  // eslint-disable-next-line no-alert, no-restricted-globals
  const ok = window.confirm('清空当前对话？这不能撤销。');
  if (ok) {
    chat.resetSession();
    if (project.projectRoot) {
      void chat.enterChat(project.projectRoot);
    }
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div
      v-if="noProject"
      class="h-full flex items-center justify-center p-6 text-sm text-muted-foreground"
    >
      先去「设置」里选一个项目目录。
    </div>

    <template v-else>
      <header class="flex items-center gap-3 px-6 py-3 border-b">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <div class="size-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-medium">
            AI
          </div>
          <span class="font-medium truncate">{{ projectLabel }} 的 IP 助手</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="!canSummarize"
          @click="onSummarize"
        >
          <Sparkles class="size-4" /> 让 DeepSeek 总结
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="busy"
          @click="onNewSession"
        >
          <RefreshCw class="size-4" /> 新会话
        </Button>
      </header>

      <div
        v-if="noKey"
        class="px-6 py-2 border-b bg-destructive/10 text-destructive text-sm"
      >
        还没配 DeepSeek key，去「设置」里加
      </div>

      <!-- placeholder for Conversation + PromptInput (Task 8 fills this in) -->
      <div class="flex-1 p-6 text-sm text-muted-foreground">
        对话区占位（下一步填）。chat messages: {{ chat.messages.length }}, phase: {{ chat.phase }}.
      </div>

      <!-- placeholder for PromptInput (Task 8 fills this in) -->

      <div
        v-if="chat.lastError"
        class="px-6 py-2 border-t bg-destructive/10 text-destructive text-sm"
      >
        {{ chat.lastError }}
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Type-check and lint**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.app.json && pnpm lint:eslint src/views/character/components/chat-tab.vue`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/views/character/components/chat-tab.vue
git commit -m "feat(chat-tab): header with project label, summary and new-session buttons"
```

---

### Task 8: Implement message list and prompt input

**Files:**
- Modify: `src/views/character/components/chat-tab.vue`

- [ ] **Step 1: Add imports and wire up the message list + prompt input**

Add to the `<script setup>` block:

```ts
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import MarkdownRenderer from '@/components/markdown-renderer.vue';
import { useAppStore } from '@/stores/app';
import { Loader } from '@/components/ai-elements/loader';
import { ref } from 'vue';

const draft = ref('');
const app = useAppStore();
const isReasoner = computed(() => /reasoner/i.test(app.settings.deepseekModel));

function onSubmit() {
  const text = draft.value.trim();
  if (!text || busy.value) {
    return;
  }
  draft.value = '';
  void onSend(text);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSubmit();
  }
}
```

- [ ] **Step 2: Replace the placeholder div with `Conversation + Message` + add `PromptInput`**

Replace the `<div class="flex-1 p-6 text-sm text-muted-foreground">…</div>` block in the template with:

```vue
    <Conversation class="flex-1">
      <ConversationContent>
        <div
          v-if="chat.messages.length === 0"
          class="flex items-center justify-center h-full text-sm text-muted-foreground"
        >
          让 DeepSeek 主动开场问第一个问题…
        </div>
        <Message
          v-for="msg in chat.messages"
          :key="msg.id"
          :from="msg.role"
        >
          <MessageContent>
            <Reasoning v-if="msg.reasoning" :is-streaming="chat.phase === 'streaming-chat' && msg === chat.messages[chat.messages.length - 1]">
              <ReasoningTrigger />
              <ReasoningContent>{{ msg.reasoning }}</ReasoningContent>
            </Reasoning>
            <MarkdownRenderer
              v-if="msg.role === 'assistant'"
              :content="msg.content"
              :is-streaming="chat.phase !== 'idle' && msg === chat.messages[chat.messages.length - 1] && !msg.failed"
            />
            <div
              v-else
              class="whitespace-pre-wrap break-words"
            >
              {{ msg.content }}
            </div>
            <div
              v-if="msg.failed"
              class="text-xs text-destructive mt-1"
            >
              {{ msg.content }}
            </div>
          </MessageContent>
        </Message>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>

    <PromptInput class="border-t" @submit="onSubmit">
      <PromptInputBody>
        <PromptInputTextarea
          v-model="draft"
          placeholder="跟 DeepSeek 聊聊这位角色…  (Enter 发送 / Shift+Enter 换行)"
          :disabled="busy || noKey"
          @keydown="onKeydown"
        />
        <PromptInputSubmit
          :disabled="busy || !draft.trim() || noKey"
        >
          <Loader v-if="busy" class="size-4 animate-spin" />
          <span v-else>发送</span>
        </PromptInputSubmit>
      </PromptInputBody>
    </PromptInput>
```

- [ ] **Step 3: Check the reasoning and message components exist**

Run: `ls src/components/ai-elements/reasoning src/components/ai-elements/prompt-input 2>&1`
Expected: `reasoning` and `prompt-input` directories exist (verified earlier). If any component has a different filename, adjust the imports — they're stable in ai-elements 1.x but verify the actual files at the listed paths.

- [ ] **Step 4: Type-check, lint, and build**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.app.json && pnpm lint:eslint src/views/character/components/chat-tab.vue`
Expected: clean. If TS complains about missing exports, the ai-elements dir is the source of truth — open the corresponding `index.ts` and adjust imports.

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: builds successfully.

- [ ] **Step 6: Commit**

```bash
git add src/views/character/components/chat-tab.vue
git commit -m "feat(chat-tab): conversation + prompt input wired to store"
```

---

### Task 9: Implement `chat-summary-preview.vue`

**Files:**
- Create: `src/views/character/components/chat-summary-preview.vue`
- Modify: `src/views/character/components/chat-tab.vue` (mount it inside, gated by phase)

- [ ] **Step 1: Create the preview component**

```vue
<script setup lang="ts">
import MarkdownRenderer from '@/components/markdown-renderer.vue';
import { useChatStore } from '@/stores/chat';

const emit = defineEmits<{
  (e: 'accept'): void;
  (e: 'cancel'): void;
}>();

const chat = useChatStore();
const draft = computed(() => {
  const last = chat.messages[chat.messages.length - 1];
  return last && last.role === 'assistant' ? last.content : '';
});
</script>

<template>
  <div class="border-t bg-muted/30 p-4 space-y-3">
    <header class="flex items-center justify-between">
      <h3 class="font-medium">
        DeepSeek 写出来的 ip.md 预览
      </h3>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="emit('cancel')">
          取消
        </Button>
        <Button size="sm" @click="emit('accept')">
          保存到 ip.md
        </Button>
      </div>
    </header>
    <div class="rounded border bg-background p-4 max-h-[40vh] overflow-auto">
      <MarkdownRenderer :content="draft" :is-streaming="false" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Mount it inside `chat-tab.vue`, gated by `phase==='preview'`**

In `chat-tab.vue`, add to the `<script setup>`:

```ts
import ChatSummaryPreview from './chat-summary-preview.vue';

function onAcceptPreview() {
  chat.acceptSummary();
  emit('accepted');
}
function onCancelPreview() {
  chat.cancelPreview();
}
```

Then add at the very end of the `<template>`, just before the last error banner (or after the `PromptInput`, whichever keeps visual order correct — preview should appear *above* the input area):

```vue
    <ChatSummaryPreview
      v-if="chat.phase === 'preview'"
      @accept="onAcceptPreview"
      @cancel="onCancelPreview"
    />
```

- [ ] **Step 3: Type-check, lint, build**

Run: `pnpm exec vue-tsc --noEmit -p tsconfig.app.json && pnpm lint:eslint src/views/character/components && pnpm build`
Expected: clean. Preview panel only renders when the user clicks 「让 DeepSeek 总结」 and DeepSeek finishes streaming.

- [ ] **Step 4: Commit**

```bash
git add src/views/character/components/chat-summary-preview.vue src/views/character/components/chat-tab.vue
git commit -m "feat(chat-tab): summary preview panel with save/cancel"
```

---

## Phase 5 — Wiring + verification

### Task 10: Manual e2e checklist run-through

**Files:** none modified, only verified.

- [ ] **Step 1: Start the Tauri dev app**

Run: `pnpm tauri:dev`
Expected: window opens. Project dir is whatever's in localStorage; if none, the app prompts to pick a directory.

- [ ] **Step 2: Set up a test scenario**

1. Choose or create a project directory (any empty folder works).
2. Add an empty `ip.md` (touch `<root>/ip.md`) so the snapshot has something for `mode!='prompt'` deltas to play with.
3. Add `DEEPSEEK_API_KEY=sk-...` to `<root>/.env`.
4. In「设置」, pick that project dir. Set model to `deepseek-chat`.
5. Navigate to 「角色」page.

- [ ] **Step 3: Run the 9-item checklist from spec §9.3**

Check off each in your head / notebook:

1. ✅ Clear DeepSeek key → 「对话」 tab → 红条「还没配 key」
2. ✅ No key → summary button disabled, PromptInput disabled
3. ✅ 「对话」 tab → DeepSeek opener streams in → type → stream reply → reasoning collapse visible only with `deepseek-reasoner` model
4. ✅ 3 turns → click 「让 DeepSeek 总结」 → preview appears → markdown renders
5. ✅ Preview → 「保存到 ip.md」 → switches to 「手写」 tab → TipTap shows dirty → click 保存 → on-disk `ip.md` updated
6. ✅ Back to 「对话」 tab → history preserved
7. ✅ 「新会话」 → confirm dialog → cleared
8. ✅ Trigger 4xx (e.g. misspell key) → toast + red bar + placeholder `[error: ...]`
9. ✅ Edit ip.md in 「手写」 tab → switch to 「对话」 tab → snapshotIp is the original snapshot, not the edited one

- [ ] **Step 4: Note any defects**

If any checklist item failed, file a follow-up and either fix inline (small) or open an issue. Do **not** mark this plan complete with any failing items.

- [ ] **Step 5: Final Rust test sweep**

Run: `cd src-tauri && cargo test --lib -- --quiet`
Expected: all tests pass (7 from character_chat + existing deepseek + project tests).

- [ ] **Step 6: Final pnpm build + lint**

Run: `pnpm build && pnpm lint:eslint`
Expected: green.

- [ ] **Step 7: Commit anyfixes-if-needed, then tag the PR**

```bash
# Only if Step 4 surfaced fixes
git add <touched files>
git commit -m "fix(character-chat): post-checklist polish"

# Tag the branch (do not push unless asked)
git tag feat/character-chat
```

---

## Done

When all 10 tasks are checked, the spec is implemented and the 不可协商 constraints are preserved:
- All HTTP still in Rust; new commands `chat_ip` / `summarize_ip` reuse `deepseek::stream_chat`.
- `ip.md` only writes via existing `write_context` path (after user clicks 「保存」 in 「手写」 tab).
- Writer path untouched; new `mode` / `request_id` fields are additive on `DeepSeekDelta` (`#[serde(default)]`).
- `deepseek.rs` / `project.rs` / `context-editor.vue` / `stores/context.ts` / writer unchanged.
