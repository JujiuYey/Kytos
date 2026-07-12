//! Project-structure operations: scan a project directory, derive paths, parse prompt
//! files. All functions in this module are pure / filesystem-only — no HTTP, no Tauri.

use std::path::{Path, PathBuf};

use regex::Regex;
use serde::Serialize;
use tokio::fs;

use crate::gacha::error::ApiMartError;

/// Reference images attached to every draw by default (the character definition).
/// Paths are resolved relative to the project root.
pub const CHARACTER_REFS: &[&str] = &["角色/定妆照.png", "角色/角色表.png"];

/// Filename where the API key lives inside the project root.
const ENV_FILE: &str = ".env";

const ENV_KEY_NAME: &str = "APIMART_API_KEY";

/// The directive line at the top of a prompt md, e.g. `<!-- size: 1:1 -->`.
const DIRECTIVE_PATTERN: &str = r"(?m)^<!--\s*(size|resolution)\s*:\s*(\S+?)\s*-->\s*$";

/// One prompt md discovered in a project, plus the cards already drawn for it.
#[derive(Debug, Clone, Serialize)]
pub struct PromptSummary {
    /// Display name, e.g. "06-慌了".
    pub name: String,
    /// Absolute path to the prompt md.
    pub md_path: String,
    /// Parsed size directive, with the default filled in if missing.
    pub size: String,
    /// Parsed resolution directive, with the default filled in if missing.
    pub resolution: String,
    /// Existing cards for this prompt, sorted by index ascending.
    pub images: Vec<ImageRef>,
}

/// A single image file already on disk for a prompt.
#[derive(Debug, Clone, Serialize)]
pub struct ImageRef {
    /// Absolute path to the image.
    pub path: String,
    /// Numeric suffix, e.g. `01` for `06-慌了-01.png`.
    pub index: u32,
    /// File modification time, used as a cache buster on the frontend.
    pub mtime: u64,
}

/// One category folder inside the project root (anything that contains `prompt/`).
#[derive(Debug, Clone, Serialize)]
pub struct Category {
    pub name: String,
    pub prompts: Vec<PromptSummary>,
}

/// Project-level information: scanned categories + presence of baselines + API key.
#[derive(Debug, Clone, Serialize)]
pub struct Project {
    pub root: String,
    pub categories: Vec<Category>,
    pub baselines: Baselines,
    pub has_api_key: bool,
}

/// Baseline reference images at the project root.
#[derive(Debug, Clone, Serialize)]
pub struct Baselines {
    pub dingzhuangzhao: Option<BaselineFile>,
    pub jiaosebiao: Option<BaselineFile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BaselineFile {
    pub path: String,
    pub mtime: u64,
}

/// A prompt md as the editor sees it: raw bytes + split directives.
#[derive(Debug, Clone, Serialize)]
pub struct PromptDetail {
    pub raw: String,
    pub prompt: String,
    pub size: String,
    pub resolution: String,
}

/// Strip `<!-- size: -->` / `<!-- resolution: -->` lines from a prompt md.
/// Returns the stripped body and a map of directives found.
pub fn split_directives(text: &str) -> (String, std::collections::HashMap<String, String>) {
    let pattern = Regex::new(DIRECTIVE_PATTERN).expect("DIRECTIVE_PATTERN is a valid regex");
    let mut directives = std::collections::HashMap::new();
    for cap in pattern.captures_iter(text) {
        directives.insert(cap[1].to_string(), cap[2].to_string());
    }
    let stripped = pattern.replace_all(text, "").trim().to_string();
    (stripped, directives)
}

/// `<类目>/prompt/x.md` → `<类目>/images/`. If the md isn't inside `prompt/`,
/// fall back to a sibling `images/` (defensive — the convention is strict).
pub fn resolve_output_dir(md_file: &Path) -> PathBuf {
    if md_file.parent().is_some_and(|p| p.file_name().is_some_and(|n| n == "prompt")) {
        if let Some(prompt_dir) = md_file.parent() {
            if let Some(category_dir) = prompt_dir.parent() {
                return category_dir.join("images");
            }
        }
    }
    md_file.parent().map(|p| p.join("images")).unwrap_or_else(|| PathBuf::from("images"))
}

/// Next index for a prompt's output sequence. Scans `<name>-NN.png` in the
/// output directory, returns `max + 1` (or `1` if none exist).
pub fn next_index(output_dir: &Path, name: &str) -> u32 {
    let Ok(entries) = std::fs::read_dir(output_dir) else {
        return 1;
    };
    let prefix = format!("{name}-");
    let mut max_seen = 0u32;
    for entry in entries.flatten() {
        let file_name = match entry.file_name().into_string() {
            Ok(s) => s,
            Err(_) => continue,
        };
        if !file_name.starts_with(&prefix) || !file_name.ends_with(".png") {
            continue;
        }
        let stem = &file_name[prefix.len()..file_name.len() - ".png".len()];
        if let Ok(n) = stem.parse::<u32>() {
            if n > max_seen {
                max_seen = n;
            }
        }
    }
    max_seen + 1
}

/// Scan a project directory for category folders. A "category" is any
/// direct subdirectory of `root` that contains a `prompt/` subdirectory.
/// Categories are sorted by name.
pub async fn scan_project(root: &Path) -> Result<Project, ApiMartError> {
    if !root.is_dir() {
        return Err(ApiMartError(format!("项目根目录不存在: {}", root.display())));
    }

    let mut category_dirs: Vec<PathBuf> = Vec::new();
    let mut read_dir = fs::read_dir(root).await.map_err(|e| ApiMartError(format!("读取项目目录失败: {e}")))?;
    while let Some(entry) = read_dir.next_entry().await.map_err(|e| ApiMartError(format!("读取项目目录失败: {e}")))? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let prompt_dir = path.join("prompt");
        if prompt_dir.is_dir() {
            category_dirs.push(path);
        }
    }
    category_dirs.sort();

    let mut categories = Vec::with_capacity(category_dirs.len());
    for dir in category_dirs {
        let name = dir.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let prompts = scan_prompts_in(&dir).await?;
        categories.push(Category { name, prompts });
    }

    let baselines = read_baselines(root).await;
    let has_api_key = read_api_key(root).await?.is_some();

    Ok(Project {
        root: root.to_string_lossy().to_string(),
        categories,
        baselines,
        has_api_key,
    })
}

async fn scan_prompts_in(category_dir: &Path) -> Result<Vec<PromptSummary>, ApiMartError> {
    let prompt_dir = category_dir.join("prompt");
    let images_dir = category_dir.join("images");

    let mut entries = fs::read_dir(&prompt_dir).await.map_err(|e| ApiMartError(format!("读取 prompt 目录失败: {e}")))?;
    let mut md_files: Vec<PathBuf> = Vec::new();
    while let Some(entry) = entries.next_entry().await.map_err(|e| ApiMartError(format!("读取 prompt 目录失败: {e}")))? {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            md_files.push(path);
        }
    }
    md_files.sort();

    let mut summaries = Vec::with_capacity(md_files.len());
    for md_path in md_files {
        let name = md_path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let raw = fs::read_to_string(&md_path).await.map_err(|e| ApiMartError(format!("读取 prompt 失败 {}: {e}", md_path.display())))?;
        let (_prompt, directives) = split_directives(&raw);
        let size = directives.get("size").cloned().unwrap_or_else(|| crate::gacha::apimart::DEFAULT_SIZE.to_string());
        let resolution = directives.get("resolution").cloned().unwrap_or_else(|| crate::gacha::apimart::DEFAULT_RESOLUTION.to_string());
        let images = scan_images_in(&images_dir, &name).await?;
        summaries.push(PromptSummary {
            name,
            md_path: md_path.to_string_lossy().to_string(),
            size,
            resolution,
            images,
        });
    }
    Ok(summaries)
}

async fn scan_images_in(images_dir: &Path, prompt_name: &str) -> Result<Vec<ImageRef>, ApiMartError> {
    let prefix = format!("{prompt_name}-");
    let mut refs = Vec::new();

    let Ok(mut entries) = fs::read_dir(images_dir).await else {
        return Ok(refs);
    };
    while let Some(entry) = entries.next_entry().await.map_err(|e| ApiMartError(format!("读取 images 目录失败: {e}")))? {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("png") {
            continue;
        }
        let file_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        if !file_name.starts_with(&prefix) {
            continue;
        }
        let stem = &file_name[prefix.len()..file_name.len() - ".png".len()];
        let index = match stem.parse::<u32>() {
            Ok(n) => n,
            Err(_) => continue,
        };
        let metadata = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };
        let mtime = metadata.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
        refs.push(ImageRef {
            path: path.to_string_lossy().to_string(),
            index,
            mtime,
        });
    }
    refs.sort_by_key(|r| r.index);
    Ok(refs)
}

async fn read_baselines(root: &Path) -> Baselines {
    Baselines {
        dingzhuangzhao: read_baseline_file(&root.join("角色").join("定妆照.png")).await,
        jiaosebiao: read_baseline_file(&root.join("角色").join("角色表.png")).await,
    }
}

async fn read_baseline_file(path: &Path) -> Option<BaselineFile> {
    let metadata = tokio::fs::metadata(path).await.ok()?;
    let mtime = metadata.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
    Some(BaselineFile {
        path: path.to_string_lossy().to_string(),
        mtime,
    })
}

/// Read the project-level API key from `<root>/.env`. Returns `None` if the
/// file is missing or the key isn't set.
pub async fn read_api_key(root: &Path) -> Result<Option<String>, ApiMartError> {
    let env_path = root.join(ENV_FILE);
    let Ok(content) = fs::read_to_string(&env_path).await else {
        return Ok(None);
    };
    for line in content.lines() {
        if let Some((name, value)) = line.split_once('=') {
            if name.trim() == ENV_KEY_NAME {
                let trimmed = value.trim().trim_matches(|c| c == '\'' || c == '"');
                if !trimmed.is_empty() {
                    return Ok(Some(trimmed.to_string()));
                }
            }
        }
    }
    Ok(None)
}

/// Write (or replace) the API key in `<root>/.env`. Preserves other lines.
pub async fn write_api_key(root: &Path, key: &str) -> Result<(), ApiMartError> {
    let env_path = root.join(ENV_FILE);
    let existing = fs::read_to_string(&env_path).await.ok();
    let mut lines: Vec<String> = match existing {
        Some(s) => s.lines().map(str::to_string).collect(),
        None => Vec::new(),
    };
    let mut found = false;
    for line in lines.iter_mut() {
        if let Some((name, _)) = line.split_once('=') {
            if name.trim() == ENV_KEY_NAME {
                *line = format!("{ENV_KEY_NAME}={key}");
                found = true;
            }
        }
    }
    if !found {
        lines.push(format!("{ENV_KEY_NAME}={key}"));
    }
    let body = lines.join("\n") + "\n";
    fs::write(&env_path, body).await.map_err(|e| ApiMartError(format!("写 .env 失败: {e}")))?;
    Ok(())
}

/// Read a prompt md and return the detail struct the editor needs.
pub async fn read_prompt(md_path: &Path) -> Result<PromptDetail, ApiMartError> {
    let raw = fs::read_to_string(md_path).await.map_err(|e| ApiMartError(format!("读取 prompt 失败: {e}")))?;
    let (prompt, directives) = split_directives(&raw);
    let size = directives.get("size").cloned().unwrap_or_else(|| crate::gacha::apimart::DEFAULT_SIZE.to_string());
    let resolution = directives.get("resolution").cloned().unwrap_or_else(|| crate::gacha::apimart::DEFAULT_RESOLUTION.to_string());
    Ok(PromptDetail { raw, prompt, size, resolution })
}

/// Overwrite a prompt md with new content. Caller is responsible for keeping
/// the directives inside `raw` if they want them preserved.
pub async fn write_prompt(md_path: &Path, raw: &str) -> Result<(), ApiMartError> {
    fs::write(md_path, raw).await.map_err(|e| ApiMartError(format!("写 prompt 失败: {e}")))?;
    Ok(())
}

/// Copy `image_path` to `<root>/角色/<target>.png`. `target` must be either
/// `定妆照` or `角色表`.
pub async fn set_baseline(root: &Path, image_path: &Path, target: &str) -> Result<(), ApiMartError> {
    let file_name = match target {
        "定妆照" => "定妆照.png",
        "角色表" => "角色表.png",
        _ => return Err(ApiMartError(format!("未知的目标基准: {target}"))),
    };
    let dest = root.join("角色").join(file_name);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).await.map_err(|e| ApiMartError(format!("创建 角色 目录失败: {e}")))?;
    }
    fs::copy(image_path, &dest).await.map_err(|e| ApiMartError(format!("覆盖基准失败: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_directives_strips_size_and_resolution() {
        let text = "<!-- size: 1:1 -->\n<!-- resolution: 2k -->\n\n参考图里的人\n";
        let (stripped, directives) = split_directives(text);
        assert_eq!(directives.get("size"), Some(&"1:1".to_string()));
        assert_eq!(directives.get("resolution"), Some(&"2k".to_string()));
        assert!(!stripped.contains("<!--"));
        assert!(stripped.contains("参考图里的人"));
    }

    #[test]
    fn split_directives_handles_no_directives() {
        let text = "纯文本，没指令。\n第二行。\n";
        let (stripped, directives) = split_directives(text);
        assert!(directives.is_empty());
        assert_eq!(stripped, "纯文本，没指令。\n第二行。");
    }

    #[test]
    fn split_directives_preserves_body_whitespace() {
        let text = "<!-- size: 16:9 -->\n\n第一段\n\n第二段\n";
        let (stripped, _) = split_directives(text);
        assert!(stripped.starts_with("第一段"));
    }

    #[test]
    fn resolve_output_dir_uses_parent_when_in_prompt() {
        let md = Path::new("/root/表情/prompt/06-慌了.md");
        assert_eq!(resolve_output_dir(md), Path::new("/root/表情/images"));
    }

    #[test]
    fn resolve_output_dir_falls_back_to_sibling() {
        let md = Path::new("/root/loose/x.md");
        assert_eq!(resolve_output_dir(md), Path::new("/root/loose/images"));
    }

    #[test]
    fn next_index_starts_at_one_when_empty() {
        let dir = tempdir();
        assert_eq!(next_index(&dir, "06-慌了"), 1);
    }

    #[test]
    fn next_index_takes_max_plus_one() {
        let dir = tempdir();
        std::fs::write(dir.join("06-慌了-01.png"), b"").unwrap();
        std::fs::write(dir.join("06-慌了-02.png"), b"").unwrap();
        std::fs::write(dir.join("06-慌了-05.png"), b"").unwrap();
        std::fs::write(dir.join("other-99.png"), b"").unwrap();
        assert_eq!(next_index(&dir, "06-慌了"), 6);
    }

    fn tempdir() -> std::path::PathBuf {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("ip-creator-test-{}-{}", std::process::id(), nanos));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}