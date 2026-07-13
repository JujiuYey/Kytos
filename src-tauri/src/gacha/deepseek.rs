//! DeepSeek chat client. Mirrors `gacha::apimart`'s split: pure payload
//! builders in this file, thin Tauri commands wired in `mod.rs`. The
//! streaming chat endpoint returns SSE; the byte buffer and per-line
//! decode here protect UTF-8 boundaries from being split across HTTP
//! chunks.

use std::time::Duration;

use futures_util::StreamExt;
use serde_json::{json, Value};

use crate::gacha::error::ApiMartError;
use crate::gacha::project;

pub const DEFAULT_BASE_URL: &str = "https://api.deepseek.com";
pub const DEFAULT_MODEL: &str = "deepseek-chat";
pub const REASONER_MODEL: &str = "deepseek-reasoner";
pub const HTTP_TIMEOUT_SECS: u64 = 300;

const USER_AGENT: &str = "Mozilla/5.0";

/// `temperature: 1.3` per DeepSeek's "general / creative" recommendation.
/// `deepseek-reasoner` does not accept this parameter and the caller
/// strips it before issuing the request.
pub const TEMPERATURE: f32 = 1.3;

/// Build the request body for a chat completion. `messages` should be
/// produced by [`build_messages`]. `temperature` is `None` for the
/// reasoner model (it isn't a configurable parameter there).
pub fn build_payload(model: &str, messages: Vec<Value>, temperature: Option<f32>, stream: bool) -> Value {
    let mut body = json!({
        "model": model,
        "messages": messages,
        "stream": stream,
    });
    if let Some(t) = temperature {
        body["temperature"] = json!(t);
    }
    body
}

/// Build the system + user messages for a generation request. Pure —
/// no I/O, no clock; the caller already loaded ip.md, agents.md, and
/// the example prompts.
///
/// The system message layers five blocks in order: task declaration,
/// raw `ip.md`, raw `AGENTS.md`, 2-3 same-category examples (or top-ups
/// from other categories), and a hard-constraints recap plus output
/// requirements. Examples are appended verbatim — model identity-lock
/// text in particular must be copied word-for-word, not paraphrased.
pub fn build_messages(
    ip: &str,
    agents: &str,
    examples: &[String],
    category: &str,
    name: &str,
    intent: &str,
) -> Vec<Value> {
    let examples_block = if examples.is_empty() {
        String::from("（该类目暂无现成范例可参考）")
    } else {
        let mut buf = String::new();
        for (i, example) in examples.iter().enumerate() {
            // Defensive: callers in `project::load_examples` already
            // strip directives, but re-strip here so a future caller
            // never accidentally feeds `<!-- size: -->` to the model.
            let (body, _) = project::split_directives(example);
            buf.push_str(&format!("\n\n--- 范例 {} ---\n{}", i + 1, body.trim()));
        }
        buf
    };

    let system = format!(
        "你是「{category}」类目的提示词作者。你写的 md 会被原样发给 gpt-image-2 来出图。\n\n\
         # 1. 角色设定（ip.md）\n\n\
         {ip}\n\n\
         # 2. 写作规范（AGENTS.md）\n\n\
         {agents}\n\n\
         # 3. 参考范例\n\n\
         下面是同类目（不足时从其他类目补）现有 md。请严格模仿其结构、语气、用词，特别是【1. 身份锁定】那段要逐字照抄：「参考图里的这个人，就是要画的人……不要复制参考图的背景和排版，只把这个人搬过来」。\
         {examples_block}\n\n\
         # 4. 必须遵守的硬约束\n\n\
         - 图生图不描述长相（已经由参考图提供）\n\
         - 【1. 身份锁定】段必须逐字照抄范例，不能改写\n\
         - 用正面句描述（不要用「不要」「不要出现」这种否定式构图）\n\
         - 只写视觉信息，不要写心理活动、情绪、内心戏\n\
         - 严格按【1. 身份锁定】【2. 场景】【3. 批注】【4. 画风收尾】四段结构\n\n\
         # 5. 输出要求\n\n\
         - 只输出 md 正文，不要任何开场白、不要解释、不要总结\n\
         - 不要用 ``` 围栏包住内容\n\
         - 不要写 `<!-- size: -->` / `<!-- resolution: -->` 这类指令行，那是给人写的、不是给你写的",
    );

    let user = format!("类目：{category}\n卡名：{name}\n意图：{intent}\n\n请按上面规范写这张卡。");

    vec![
        json!({ "role": "system", "content": system }),
        json!({ "role": "user", "content": user }),
    ]
}

/// Strip ``` ``` fences and a leading language tag if the model wrapped
/// its output. We then trim outer whitespace.
pub fn strip_fences(text: &str) -> String {
    let trimmed = text.trim();
    let rest = match trimmed.strip_prefix("```") {
        Some(s) => s,
        None => return trimmed.to_string(),
    };
    // Drop a single language tag line (e.g. "markdown") if present.
    let line_end = rest.find('\n').unwrap_or(rest.len());
    let first_line = &rest[..line_end];
    let after_tag = if line_end < rest.len() { &rest[line_end + 1..] } else { "" };
    let body = if first_line.trim().is_empty() || first_line.contains(' ') || first_line.len() < 32 {
        after_tag
    } else {
        // The first line *is* content, no language tag — keep everything.
        rest
    };
    let body = body.trim_end();
    if let Some(inner) = body.strip_suffix("```") {
        return inner.trim().to_string();
    }
    body.trim().to_string()
}

/// Build a reqwest client sized for the reasoner's longest thinking runs.
pub fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .expect("reqwest client builds with defaults")
}

/// Read the DeepSeek key from `process::env` (matches the apimart pattern).
pub fn api_key_from_env() -> Option<String> {
    std::env::var("DEEPSEEK_API_KEY").ok().filter(|s| !s.is_empty())
}

/// One SSE event parsed from the stream.
#[derive(Debug, Clone, Default)]
pub struct Delta {
    pub content: String,
    pub reasoning: String,
}

/// Stream a chat completion back to `on_delta` until `[DONE]`. Returns
/// the concatenated assistant text (content only — reasoning is sent
/// live but discarded on return because the user already saw it).
///
/// The byte buffer is the linchpin: HTTP chunks can split a 3-byte
/// Chinese character across two frames, so we accumulate raw bytes and
/// only decode UTF-8 *per complete line*. Mid-line UTF-8 errors are
/// held until the next chunk that completes the codepoint.
pub async fn stream_chat<F>(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    payload: &Value,
    mut on_delta: F,
) -> Result<String, ApiMartError>
where
    F: FnMut(Delta) + Send,
{
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let response = client
        .post(&url)
        .bearer_auth(api_key)
        .json(payload)
        .send()
        .await?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(ApiMartError(format!("DeepSeek HTTP {status}: {body}")));
    }

    let mut buffer: Vec<u8> = Vec::new();
    let mut content = String::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| ApiMartError(format!("DeepSeek stream 失败: {e}")))?;
        buffer.extend_from_slice(&bytes);
        // Split on \n, hold the tail (incomplete line) in the buffer.
        while let Some(newline_at) = buffer.iter().position(|b| *b == b'\n') {
            let line_bytes: Vec<u8> = buffer.drain(..=newline_at).collect();
            // Drop the trailing \n.
            let line_bytes = &line_bytes[..line_bytes.len() - 1];
            // Skip empty lines (SSE separators).
            if line_bytes.is_empty() {
                continue;
            }
            let line = match std::str::from_utf8(line_bytes) {
                Ok(s) => s,
                Err(_) => continue, // mid-codepoint split; skip rather than corrupt
            };
            let line = line.trim_end_matches('\r');
            if line.is_empty() {
                continue;
            }
            let Some(data) = line.strip_prefix("data:") else {
                continue; // event: / id: / retry: / heartbeat comments
            };
            let data = data.trim();
            if data == "[DONE]" {
                let content_clone = content.clone();
                return Ok(content_clone);
            }
            if let Some(delta) = parse_sse_data(data) {
                if !delta.content.is_empty() {
                    content.push_str(&delta.content);
                }
                on_delta(delta);
            }
        }
    }
    Ok(content)
}

/// Parse one `data: {...}` JSON line into a [`Delta`]. Anything we don't
/// understand comes back as empty — the stream keeps moving.
fn parse_sse_data(json_str: &str) -> Option<Delta> {
    let v: Value = serde_json::from_str(json_str).ok()?;
    let choice = v.get("choices")?.as_array()?.first()?;
    let mut delta = Delta::default();
    if let Some(content) = choice.get("delta").and_then(|d| d.get("content")).and_then(|c| c.as_str()) {
        delta.content = content.to_string();
    }
    if let Some(reasoning) = choice
        .get("delta")
        .and_then(|d| d.get("reasoning_content"))
        .and_then(|c| c.as_str())
    {
        delta.reasoning = reasoning.to_string();
    }
    Some(delta)
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

    fn last_user(messages: &[Value]) -> &str {
        messages
            .iter()
            .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("user"))
            .and_then(|m| m.get("content").and_then(|c| c.as_str()))
            .expect("user message present")
    }

    #[test]
    fn build_messages_contains_ip_and_agents_verbatim() {
        let ip = "阿九是谁\n识别锚点\n三个表演工具";
        let agents = "# 写作规范\n- 四段结构\n- 图生图不描述长相";
        let messages = build_messages(ip, agents, &[], "表情", "10-摆烂", "蹲在坑边");
        let system = last_system(&messages);
        assert!(system.contains(ip), "ip.md embedded verbatim");
        assert!(system.contains(agents), "AGENTS.md embedded verbatim");
    }

    #[test]
    fn build_messages_embeds_example_identity_lock_phrase() {
        // Why this exact phrase: it's the part AGENTS.md can never
        // safely paraphrase away. If it stops appearing in the system
        // prompt, the model starts inventing its own identity-lock and
        // breaks the house style. Test that as a regression guard.
        let identity_lock = "参考图里的这个人就是要画的人，不要复制参考图的背景和排版";
        let example = format!("【1. 身份锁定】\n{identity_lock}\n\n【2. 场景】\n他在笑\n");
        let messages = build_messages("ip", "agents", &[example], "表情", "00-x", "笑");
        let system = last_system(&messages);
        assert!(system.contains(identity_lock), "identity-lock verbatim from example");
    }

    #[test]
    fn build_messages_falls_back_to_other_categories_examples() {
        // Caller already did the fallback in project::load_examples —
        // build_messages just renders what's passed in.
        let borrowed_example = "他来自动作场景类目的范例\n".to_string();
        let messages = build_messages("ip", "agents", &[borrowed_example], "道具", "00-x", "新类目没自己的");
        let system = last_system(&messages);
        assert!(system.contains("动作场景"));
    }

    #[test]
    fn build_messages_system_prompt_excludes_directive_lines_in_examples() {
        // Spec rule 7: directives are machine instructions. They must
        // not reach the model. We re-strip in build_messages so a
        // forgetful caller (or even direct raw input) can't slip them
        // through. The system prompt itself DOES mention the syntax as
        // a meta-warning ("不要写 `<!-- size: -->`"), so we check the
        // examples block specifically.
        let raw_with_directive = "<!-- size: 1:1 -->\n<!-- resolution: 2k -->\n\n正文\n".to_string();
        let messages = build_messages("ip", "agents", &[raw_with_directive], "表情", "00-x", "");
        let system = last_system(&messages);
        // Pull out the section between "# 3. 参考范例" and "# 4".
        let examples_section = system
            .split("# 3. 参考范例")
            .nth(1)
            .and_then(|s| s.split("# 4.").next())
            .expect("examples section exists");
        assert!(
            !examples_section.contains("<!-- size:"),
            "directives stripped from examples block, got: {examples_section}"
        );
        assert!(!examples_section.contains("<!-- resolution:"));
        assert!(examples_section.contains("正文"), "body preserved");
    }

    #[test]
    fn build_messages_includes_category_name_and_intent_in_user_message() {
        let messages = build_messages("ip", "agents", &[], "表情", "11-摆烂", "蹲在坑边上往里看");
        let user = last_user(&messages);
        assert!(user.contains("表情"));
        assert!(user.contains("11-摆烂"));
        assert!(user.contains("蹲在坑边上往里看"));
    }

    #[test]
    fn build_payload_adds_temperature_for_chat_only() {
        let body = build_payload("deepseek-chat", vec![json!({"role": "user", "content": "hi"})], Some(TEMPERATURE), true);
        let t = body["temperature"].as_f64().expect("temperature present");
        assert!((t - 1.3).abs() < 1e-6, "temperature ≈ 1.3, got {t}");
        assert_eq!(body["model"], "deepseek-chat");
        assert_eq!(body["stream"], true);

        let body = build_payload("deepseek-reasoner", vec![json!({"role": "user", "content": "hi"})], None, true);
        assert!(body.get("temperature").is_none(), "reasoner omits temperature");
    }

    #[test]
    fn strip_fences_drops_backticks_and_language_tag() {
        let out = strip_fences("```markdown\n【1. 身份锁定】\n参考图里的这个人\n```\n");
        assert_eq!(out, "【1. 身份锁定】\n参考图里的这个人");
    }

    #[test]
    fn strip_fences_returns_input_unchanged_when_no_fences() {
        let raw = "【1. 身份锁定】\n参考图里的这个人\n";
        assert_eq!(strip_fences(raw), raw.trim());
    }

    #[test]
    fn strip_fences_handles_unclosed_fence_gracefully() {
        // If the model forgot the closing fence, don't crash — strip the
        // opener and move on.
        let out = strip_fences("```markdown\n正文但忘了关围栏");
        assert_eq!(out, "正文但忘了关围栏");
    }

    #[test]
    fn parse_sse_data_extracts_content() {
        let line = r#"{"choices":[{"delta":{"content":"你好"}}]}"#;
        let delta = parse_sse_data(line).unwrap();
        assert_eq!(delta.content, "你好");
        assert_eq!(delta.reasoning, "");
    }

    #[test]
    fn parse_sse_data_extracts_reasoning_for_reasoner() {
        let line = r#"{"choices":[{"delta":{"reasoning_content":"思考中","content":"答"}}]}"#;
        let delta = parse_sse_data(line).unwrap();
        assert_eq!(delta.reasoning, "思考中");
        assert_eq!(delta.content, "答");
    }

    #[test]
    fn parse_sse_data_returns_none_for_non_json() {
        assert!(parse_sse_data("not json").is_none());
    }

    #[test]
    fn parse_sse_data_returns_none_for_missing_choices() {
        assert!(parse_sse_data(r#"{"choices":[]}"#).is_none());
    }
}
