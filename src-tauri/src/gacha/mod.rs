//! Tauri commands for the gacha feature. See `docs/spec-抽卡.md` for the
//! full command contracts and `docs/plan-抽卡.md` for the implementation
//! strategy.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use crate::gacha::error::ApiMartError;

pub mod apimart;
pub mod error;
pub mod project;

/// Payload sent to the frontend over `draw://progress`.
#[derive(Debug, Clone, Serialize)]
pub struct DrawProgress {
    pub stage: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
}

/// Arguments to `draw`.
#[derive(Debug, Clone, Deserialize)]
pub struct DrawRequest {
    pub root: String,
    pub md_path: String,
    #[serde(default)]
    pub no_ref: bool,
    #[serde(default)]
    pub extra_refs: Vec<String>,
    pub size: Option<String>,
    pub resolution: Option<String>,
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DrawResult {
    pub task_id: String,
    pub urls: Vec<String>,
    pub saved: Vec<String>,
    pub failed: Vec<apimart::FailedDownload>,
    /// Populated only in dry-run mode — the exact payload that *would* be
    /// sent, with base64 image URLs truncated for readability.
    pub payload_preview: Option<Value>,
}

/// Scan a project directory and return everything the UI needs to render
/// the prompt tree: categories, prompt summaries, baseline presence, and
/// whether an API key is configured.
#[tauri::command]
pub async fn scan_project(root: String) -> Result<project::Project, String> {
    project::scan_project(Path::new(&root)).await.map_err(|e| e.to_string())
}

/// Read a prompt md and return both the raw bytes (for the editor) and the
/// parsed directives + stripped prompt (for sending to the API).
#[tauri::command]
pub async fn read_prompt(md_path: String) -> Result<project::PromptDetail, String> {
    project::read_prompt(Path::new(&md_path)).await.map_err(|e| e.to_string())
}

/// Overwrite a prompt md with new content. The caller (UI) is responsible
/// for keeping directives in `raw` if they want them preserved.
#[tauri::command]
pub async fn write_prompt(md_path: String, raw: String) -> Result<(), String> {
    project::write_prompt(Path::new(&md_path), &raw).await.map_err(|e| e.to_string())
}

/// Set `<root>/角色/<target>.png` to a copy of `image_path`. `target` is
/// either `定妆照` or `角色表`. Returns nothing on success.
#[tauri::command]
pub async fn set_baseline(root: String, image_path: String, target: String) -> Result<(), String> {
    project::set_baseline(Path::new(&root), Path::new(&image_path), &target).await.map_err(|e| e.to_string())
}

/// Read the project-level API key. Returns `None` if not set.
#[tauri::command]
pub async fn read_api_key(root: String) -> Result<Option<String>, String> {
    project::read_api_key(Path::new(&root)).await.map_err(|e| e.to_string())
}

/// Write or replace the project-level API key.
#[tauri::command]
pub async fn write_api_key(root: String, key: String) -> Result<(), String> {
    project::write_api_key(Path::new(&root), &key).await.map_err(|e| e.to_string())
}

/// Submit a generation request and download the resulting image(s) into the
/// prompt's `images/` directory. Emits `draw://progress` events throughout.
///
/// In `dry_run: true` mode: builds and validates the payload but does not
/// contact APIMart or write any files. Returns a `payload_preview` instead.
#[tauri::command]
pub async fn draw(app: AppHandle, req: DrawRequest) -> Result<DrawResult, String> {
    let outcome = draw_inner(app.clone(), req).await;
    if let Err(err) = &outcome {
        let _ = app.emit(
            "draw://progress",
            DrawProgress {
                stage: "failed",
                message: err.to_string(),
                task_id: None,
            },
        );
    }
    outcome.map_err(|e| e.to_string())
}

async fn draw_inner(app: AppHandle, req: DrawRequest) -> Result<DrawResult, ApiMartError> {
    let emit = |app: AppHandle, stage: &'static str, message: String, task_id: Option<String>| {
        let _ = app.emit("draw://progress", DrawProgress { stage, message, task_id });
    };

    emit(app.clone(), "building", format!("读取 {}", req.md_path), None);

    let root = PathBuf::from(&req.root);
    let md_path = PathBuf::from(&req.md_path);
    if !md_path.is_file() {
        return Err(ApiMartError(format!("找不到文件: {}", md_path.display())));
    }

    let detail = project::read_prompt(&md_path).await?;
    if detail.prompt.is_empty() {
        return Err(ApiMartError(format!("提示词是空的: {}", md_path.display())));
    }

    let output_dir = project::resolve_output_dir(&md_path);
    let name = md_path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();

    let size = req
        .size
        .clone()
        .or_else(|| Some(detail.size.clone()))
        .unwrap_or_else(|| apimart::DEFAULT_SIZE.to_string());
    let resolution = req
        .resolution
        .clone()
        .or_else(|| Some(detail.resolution.clone()))
        .unwrap_or_else(|| apimart::DEFAULT_RESOLUTION.to_string());

    let mut references: Vec<String> = Vec::new();
    if !req.no_ref {
        for ref_path in apimart::default_character_ref_paths(&root) {
            if !ref_path.is_file() {
                return Err(ApiMartError(format!(
                    "找不到角色参考图: {}\n（如果本来就不该带参考图，加 no_ref）",
                    ref_path.display()
                )));
            }
            references.push(apimart::load_reference(&ref_path.to_string_lossy())?);
        }
    }
    for extra in &req.extra_refs {
        references.push(apimart::load_reference(extra)?);
    }

    let payload = apimart::build_payload(&detail.prompt, 1, apimart::DEFAULT_MODEL, &size, &resolution, &references)?;

    if req.dry_run {
        emit(app.clone(), "done", "dry-run 完成，没扣费".to_string(), None);
        return Ok(DrawResult {
            task_id: String::new(),
            urls: Vec::new(),
            saved: Vec::new(),
            failed: Vec::new(),
            payload_preview: Some(apimart::redact_payload(&payload)),
        });
    }

    let api_key = apimart::api_key_from_env()
        .or(project::read_api_key(&root).await?)
        .ok_or_else(|| {
            ApiMartError(
                "没找到 API key。两种办法二选一：\n  1) export APIMART_API_KEY=sk-xxx\n  2) 在项目根目录的 .env 里写一行 APIMART_API_KEY=sk-xxx".to_string(),
            )
        })?;

    let client = apimart::build_http_client();
    let task_id = apimart::submit_generation(&client, apimart::DEFAULT_BASE_URL, &api_key, &payload).await?;
    emit(app.clone(), "submitted", format!("任务已提交: {task_id}"), Some(task_id.clone()));

    let base_url = std::env::var("APIMART_BASE_URL").unwrap_or_else(|_| apimart::DEFAULT_BASE_URL.to_string());
    let completed = apimart::poll_task(&client, &base_url, &api_key, &task_id, None, None).await?;
    emit(app.clone(), "polling", "任务完成，下载图中".to_string(), Some(task_id.clone()));

    let urls = apimart::extract_image_urls(&completed)?;
    // Surface URLs to the UI before download starts so a download failure
    // doesn't lose the links (they expire in ~24h).
    let _ = app.emit(
        "draw://progress",
        DrawProgress {
            stage: "downloading",
            message: format!("生成成功，共 {} 张", urls.len()),
            task_id: Some(task_id.clone()),
        },
    );
    for url in &urls {
        emit(app.clone(), "downloading", url.clone(), Some(task_id.clone()));
    }

    tokio::fs::create_dir_all(&output_dir).await?;
    let start_index = project::next_index(&output_dir, &name);
    let (saved, failed) = apimart::download_all(&client, &urls, &output_dir, &name, start_index).await;

    emit(app.clone(), "done", format!("下载完成，{}/{} 张", saved.len(), urls.len()), Some(task_id.clone()));
    Ok(DrawResult {
        task_id,
        urls,
        saved,
        failed,
        payload_preview: None,
    })
}

/// Re-download a previously-submitted task. Use when the original `draw`
/// downloaded some or all images but the network cut out. Free.
#[tauri::command]
pub async fn fetch_task(app: AppHandle, root: String, md_path: String, task_id: String) -> Result<DrawResult, String> {
    let outcome = fetch_task_inner(app.clone(), root, md_path, task_id).await;
    if let Err(err) = &outcome {
        let _ = app.emit(
            "draw://progress",
            DrawProgress {
                stage: "failed",
                message: err.to_string(),
                task_id: None,
            },
        );
    }
    outcome.map_err(|e| e.to_string())
}

async fn fetch_task_inner(app: AppHandle, root: String, md_path: String, task_id: String) -> Result<DrawResult, ApiMartError> {
    let api_key = apimart::api_key_from_env()
        .or(project::read_api_key(Path::new(&root)).await?)
        .ok_or_else(|| ApiMartError("没找到 API key".to_string()))?;

    let client = apimart::build_http_client();
    let base_url = std::env::var("APIMART_BASE_URL").unwrap_or_else(|_| apimart::DEFAULT_BASE_URL.to_string());
    let completed = apimart::poll_task(&client, &base_url, &api_key, &task_id, None, None).await?;
    let urls = apimart::extract_image_urls(&completed)?;
    let _ = app.emit(
        "draw://progress",
        DrawProgress {
            stage: "downloading",
            message: format!("生成成功，共 {} 张", urls.len()),
            task_id: Some(task_id.clone()),
        },
    );

    let md = PathBuf::from(&md_path);
    let output_dir = project::resolve_output_dir(&md);
    let name = md.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
    tokio::fs::create_dir_all(&output_dir).await?;
    let start_index = project::next_index(&output_dir, &name);
    let (saved, failed) = apimart::download_all(&client, &urls, &output_dir, &name, start_index).await;

    let _ = app.emit(
        "draw://progress",
        DrawProgress {
            stage: "done",
            message: format!("下载完成，{}/{} 张", saved.len(), urls.len()),
            task_id: Some(task_id.clone()),
        },
    );
    Ok(DrawResult {
        task_id,
        urls,
        saved,
        failed,
        payload_preview: None,
    })
}

/// Drop-in stand-in for an `AppHandle` in tests where Tauri isn't running.
/// `emit` is a no-op.
#[cfg(test)]
pub fn dummy_app_handle() -> AppHandle {
    // Tests don't actually need to emit; we route the command's emit calls
    // through a callback. But for unit tests of pure functions we don't
    // need any of this — see integration tests instead.
    unimplemented!("dummy_app_handle is only a marker for tests")
}

#[cfg(test)]
mod tests {
    // Pure-function tests live in `project` and `apimart` modules.
    // The Tauri commands require an AppHandle and are covered by integration
    // tests in `tests/dry_run.rs`.
}