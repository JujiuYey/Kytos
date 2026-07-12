//! APIMart GPT Image 2 client: payload construction, task submission, polling,
//! result extraction, and image download. Mirrors `scripts/apimart.py` from
//! the character-gacha project. The macOS-Python SSL workaround (urllib retry
//! + curl fallback) is dropped — reqwest + rustls doesn't have that bug.

use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine as _;
use serde::Serialize;
use serde_json::Value;

use crate::gacha::error::ApiMartError;

pub const DEFAULT_BASE_URL: &str = "https://api.apimart.ai";
pub const DEFAULT_MODEL: &str = "gpt-image-2";
pub const DEFAULT_SIZE: &str = "16:9";
pub const DEFAULT_RESOLUTION: &str = "1k";

const MAX_REFERENCES: usize = 16;
const MAX_REFERENCE_BYTES: u64 = 20 * 1024 * 1024;

const SUPPORTED_REFERENCE_EXTS: &[&str] = &[".png", ".jpg", ".jpeg", ".webp"];

const POLL_INTERVAL_SECS: u64 = 5;
const POLL_TIMEOUT_SECS: u64 = 600;
const HTTP_TIMEOUT_SECS: u64 = 120;
const USER_AGENT: &str = "Mozilla/5.0";

#[derive(Debug, Clone, Serialize)]
pub struct FailedDownload {
    pub path: String,
    pub url: String,
}

/// Build the request body for a generation. Pure — no I/O.
pub fn build_payload(
    prompt: &str,
    n: u32,
    model: &str,
    size: &str,
    resolution: &str,
    references: &[String],
) -> Result<Value, ApiMartError> {
    if references.len() > MAX_REFERENCES {
        return Err(ApiMartError(format!("参考图最多 {MAX_REFERENCES} 张，当前 {} 张", references.len())));
    }
    let mut payload = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "n": n,
        "size": size,
        "resolution": resolution,
    });
    if !references.is_empty() {
        payload["image_urls"] = serde_json::Value::Array(references.iter().cloned().map(Value::String).collect());
    }
    Ok(payload)
}

/// Shorten base64 data URIs for dry-run printing, matching Python's
/// `redact_payload` exactly: first 48 chars + `...({N} chars)`.
pub fn redact_payload(payload: &Value) -> Value {
    let mut preview = payload.clone();
    if let Some(Value::Array(refs)) = preview.get_mut("image_urls") {
        *refs = refs
            .iter()
            .map(|v| match v {
                Value::String(s) if s.starts_with("data:") => Value::String(format!("{}...({} chars)", &s[..48.min(s.len())], s.len())),
                other => other.clone(),
            })
            .collect();
    }
    preview
}

/// Read a local reference image and return it as a `data:` URI. URLs and
/// existing `data:` URIs are returned unchanged.
pub fn load_reference(value: &str) -> Result<String, ApiMartError> {
    if value.starts_with("http://") || value.starts_with("https://") || value.starts_with("data:") {
        return Ok(value.to_string());
    }
    let path = Path::new(value);
    if !path.is_file() {
        return Err(ApiMartError(format!("找不到参考图: {value}")));
    }
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    let ext_with_dot = format!(".{ext}");
    if !SUPPORTED_REFERENCE_EXTS.contains(&ext_with_dot.as_str()) {
        return Err(ApiMartError(format!(
            "参考图格式不支持: {ext}，支持 png/jpg/jpeg/webp"
        )));
    }
    let mime = match ext_with_dot.as_str() {
        ".png" => "image/png",
        ".jpg" | ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        _ => unreachable!("filtered above"),
    };
    let raw = std::fs::read(path)?;
    if raw.len() as u64 > MAX_REFERENCE_BYTES {
        return Err(ApiMartError(format!(
            "参考图超过 20M: {value} ({:.1}M)",
            raw.len() as f64 / 1024.0 / 1024.0
        )));
    }
    Ok(format!("data:{};base64,{}", mime, BASE64_ENGINE.encode(&raw)))
}

/// POST the generation payload and return the task ID.
pub async fn submit_generation(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    payload: &Value,
) -> Result<String, ApiMartError> {
    let url = format!("{}/v1/images/generations", base_url.trim_end_matches('/'));
    let response = client
        .post(&url)
        .bearer_auth(api_key)
        .json(payload)
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    let data: Value = serde_json::from_str(&body).map_err(|_| ApiMartError(format!("APIMart HTTP {status}: {body}")))?;
    if !status.is_success() {
        return Err(ApiMartError(format!("APIMart HTTP {status}: {}", provider_error_message(&data))));
    }
    extract_task_id(&data)
}

/// Poll the task endpoint until it reports completion, failure, or timeout.
pub async fn poll_task(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    task_id: &str,
    interval: Option<u64>,
    timeout: Option<u64>,
) -> Result<Value, ApiMartError> {
    let interval = interval.unwrap_or(POLL_INTERVAL_SECS);
    let timeout = timeout.unwrap_or(POLL_TIMEOUT_SECS);
    let url = format!("{}/v1/tasks/{task_id}", base_url.trim_end_matches('/'));
    let deadline = std::time::Instant::now() + Duration::from_secs(timeout);

    loop {
        let data = request_get(client, &url, api_key).await?;
        match task_status(&data).as_str() {
            "completed" | "succeeded" | "success" => return Ok(data),
            "failed" | "error" | "cancelled" | "canceled" => {
                return Err(ApiMartError(format!("APIMart task {task_id} failed: {}", provider_error_message(&data))));
            }
            _ => {}
        }
        if std::time::Instant::now() >= deadline {
            let status = task_status(&data);
            return Err(ApiMartError(format!(
                "Timed out waiting for APIMart task {task_id}; last status: {}",
                if status.is_empty() { "unknown" } else { &status }
            )));
        }
        tokio::time::sleep(Duration::from_secs(interval)).await;
    }
}

async fn request_get(client: &reqwest::Client, url: &str, api_key: &str) -> Result<Value, ApiMartError> {
    let response = client.get(url).bearer_auth(api_key).send().await?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    let data: Value = serde_json::from_str(&body).map_err(|_| ApiMartError(format!("APIMart HTTP {status}: {body}")))?;
    if !status.is_success() {
        return Err(ApiMartError(format!("APIMart HTTP {status}: {}", provider_error_message(&data))));
    }
    Ok(data)
}

pub fn extract_image_urls(data: &Value) -> Result<Vec<String>, ApiMartError> {
    let images = data
        .get("data")
        .and_then(|d| d.get("result"))
        .and_then(|r| r.get("images"))
        .and_then(|i| i.as_array());
    let mut urls = Vec::new();
    if let Some(images) = images {
        for image in images {
            if let Some(url) = image.get("url").and_then(|u| u.as_str()) {
                urls.push(url.to_string());
            }
            else if let Some(arr) = image.get("url").and_then(|u| u.as_array()) {
                for u in arr {
                    if let Some(s) = u.as_str() {
                        urls.push(s.to_string());
                    }
                }
            }
        }
    }
    if urls.is_empty() {
        return Err(ApiMartError(format!("Completed task did not include image URLs: {}", provider_error_message(data))));
    }
    Ok(urls)
}

fn extract_task_id(data: &Value) -> Result<String, ApiMartError> {
    let mut candidates: Vec<&Value> = Vec::new();
    if let Some(obj) = data.as_object() {
        candidates.push(obj.get("task_id").unwrap_or(&Value::Null));
        candidates.push(obj.get("data").unwrap_or(&Value::Null));
        if let Some(arr) = obj.get("data").and_then(|v| v.as_array()) {
            for v in arr {
                candidates.push(v);
            }
        }
        else if let Some(inner) = obj.get("data").and_then(|v| v.as_object()) {
            candidates.push(inner.get("task_id").unwrap_or(&Value::Null));
        }
    }
    for candidate in candidates {
        if let Some(s) = candidate.as_str() {
            if !s.is_empty() {
                return Ok(s.to_string());
            }
        }
        if let Some(obj) = candidate.as_object() {
            if let Some(s) = obj.get("task_id").and_then(|v| v.as_str()) {
                if !s.is_empty() {
                    return Ok(s.to_string());
                }
            }
        }
    }
    Err(ApiMartError(format!("APIMart response did not contain task_id: {}", provider_error_message(data))))
}

fn task_status(data: &Value) -> String {
    if let Some(obj) = data.as_object() {
        if let Some(s) = obj
            .get("data")
            .and_then(|d| d.get("status"))
            .and_then(|v| v.as_str())
        {
            return s.to_string();
        }
        if let Some(s) = obj.get("status").and_then(|v| v.as_str()) {
            return s.to_string();
        }
    }
    String::new()
}

fn provider_error_message(data: &Value) -> String {
    if let Some(obj) = data.as_object() {
        if let Some(err) = obj.get("error").and_then(|e| e.as_object()) {
            if let Some(msg) = err.get("message").and_then(|m| m.as_str()) {
                return msg.to_string();
            }
        }
        if let Some(msg) = obj.get("message").and_then(|m| m.as_str()) {
            return msg.to_string();
        }
    }
    data.to_string()
}

/// Build a reqwest client with sensible defaults for the APIMart API.
pub fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .expect("reqwest client builds with defaults")
}

/// Download all generated images. On failure, the URL is captured so the user
/// can retry via `fetch_task` without being charged again.
pub async fn download_all(
    client: &reqwest::Client,
    urls: &[String],
    output_dir: &Path,
    name: &str,
    start_index: u32,
) -> (Vec<String>, Vec<FailedDownload>) {
    tokio::fs::create_dir_all(output_dir).await.ok();
    let mut saved = Vec::new();
    let mut failed = Vec::new();
    for (offset, url) in urls.iter().enumerate() {
        let index = start_index + offset as u32;
        let output_path = output_dir.join(format!("{name}-{index:02}.png"));
        match download_file(client, url, &output_path).await {
            Ok(()) => saved.push(output_path.to_string_lossy().to_string()),
            Err(_) => failed.push(FailedDownload {
                path: output_path.to_string_lossy().to_string(),
                url: url.clone(),
            }),
        }
    }
    (saved, failed)
}

/// Single-attempt download. reqwest + rustls doesn't need the urllib retry
/// loop or the macOS-Python curl fallback that `apimart.py` carries.
async fn download_file(client: &reqwest::Client, url: &str, output_path: &Path) -> Result<(), ApiMartError> {
    let bytes = client.get(url).send().await?.bytes().await?;
    tokio::fs::write(output_path, &bytes).await?;
    Ok(())
}

/// Collect the default character reference paths for a project, joined to
/// absolute paths under `root`. Caller decides whether to load them.
pub fn default_character_ref_paths(root: &Path) -> Vec<PathBuf> {
    crate::gacha::project::CHARACTER_REFS.iter().map(|p| root.join(p)).collect()
}

/// Read the API key from `process::env` (matches Python's first-priority source).
pub fn api_key_from_env() -> Option<String> {
    std::env::var("APIMART_API_KEY").ok().filter(|s| !s.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn build_payload_adds_references_only_when_provided() {
        let p = build_payload("hi", 1, DEFAULT_MODEL, DEFAULT_SIZE, DEFAULT_RESOLUTION, &[]).unwrap();
        assert!(p.get("image_urls").is_none());
        assert_eq!(p["model"], "gpt-image-2");
        assert_eq!(p["n"], 1);
    }

    #[test]
    fn build_payload_rejects_too_many_references() {
        let refs: Vec<String> = (0..MAX_REFERENCES + 1).map(|i| format!("data:image/png;base64,{i}")).collect();
        assert!(build_payload("hi", 1, DEFAULT_MODEL, DEFAULT_SIZE, DEFAULT_RESOLUTION, &refs).is_err());
    }

#[test]
    fn redact_payload_truncates_data_uris() {
        let payload = json!({
            "image_urls": [
                "data:image/png;base64,abcdefghijklmnopqrstuvwxyz0123456789abcdefghijkl",
                "https://example.com/img.png"
            ]
        });
        let preview = redact_payload(&payload);
        let first = preview["image_urls"][0].as_str().unwrap();
        // First 48 chars of the input end at "...abcdefghijklmnopqrstuvwxyz",
        // then `...({full_length} chars)` is appended.
        assert!(first.starts_with("data:image/png;base64,abcdefghijklmnopqrstuvwxyz"));
        assert!(first.contains("70 chars)"));
        assert_eq!(preview["image_urls"][1].as_str().unwrap(), "https://example.com/img.png");
    }

    #[test]
    fn extract_image_urls_handles_string_and_list() {
        let data = json!({
            "data": {
                "result": {
                    "images": [
                        { "url": "https://example.com/a.png" },
                        { "url": ["https://example.com/b.png", "https://example.com/c.png"] }
                    ]
                }
            }
        });
        let urls = extract_image_urls(&data).unwrap();
        assert_eq!(urls, vec!["https://example.com/a.png", "https://example.com/b.png", "https://example.com/c.png"]);
    }

    #[test]
    fn extract_image_urls_errors_when_empty() {
        let data = json!({"data": {"result": {"images": []}}});
        assert!(extract_image_urls(&data).is_err());
    }

    #[test]
    fn extract_task_id_finds_top_level_string() {
        let data = json!({"task_id": "abc123"});
        assert_eq!(extract_task_id(&data).unwrap(), "abc123");
    }

    #[test]
    fn extract_task_id_finds_in_data_object() {
        let data = json!({"data": {"task_id": "xyz"}});
        assert_eq!(extract_task_id(&data).unwrap(), "xyz");
    }

    #[test]
    fn extract_task_id_finds_in_data_list() {
        let data = json!({"data": [{"task_id": "q"}, {"task_id": "r"}]});
        assert_eq!(extract_task_id(&data).unwrap(), "q");
    }

    #[test]
    fn task_status_reads_data_status() {
        assert_eq!(task_status(&json!({"data": {"status": "completed"}})), "completed");
        assert_eq!(task_status(&json!({"status": "running"})), "running");
        assert_eq!(task_status(&json!({})), "");
    }

    #[test]
    fn provider_error_message_prefers_error_message() {
        let data = json!({"error": {"message": "boom"}});
        assert_eq!(provider_error_message(&data), "boom");
    }

    #[test]
    fn provider_error_message_falls_back_to_message() {
        let data = json!({"message": "fallback"});
        assert_eq!(provider_error_message(&data), "fallback");
    }
}