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
/// `messages` argument. The system prompt is inlined verbatim from
/// spec §4.1 with `{project_label}` and `{ip_md_or_empty}` substituted
/// in (see `docs/superpowers/specs/2026-07-13-character-chat-design.md`).
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