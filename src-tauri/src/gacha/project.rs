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

pub const APIMART_API_KEY_NAME: &str = "APIMART_API_KEY";
pub const DEEPSEEK_API_KEY_NAME: &str = "DEEPSEEK_API_KEY";

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
    #[serde(rename = "has_deepseek_key")]
    pub has_deepseek_key: bool,
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
    let has_deepseek_key = read_env_key(root, DEEPSEEK_API_KEY_NAME).await?.is_some();

    Ok(Project {
        root: root.to_string_lossy().to_string(),
        categories,
        baselines,
        has_api_key,
        has_deepseek_key,
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

/// Read a project-level key from `<root>/.env`. Returns `None` if the
/// file is missing or the key isn't set.
pub async fn read_env_key(root: &Path, name: &str) -> Result<Option<String>, ApiMartError> {
    let env_path = root.join(ENV_FILE);
    let Ok(content) = fs::read_to_string(&env_path).await else {
        return Ok(None);
    };
    for line in content.lines() {
        if let Some((line_name, value)) = line.split_once('=') {
            if line_name.trim() == name {
                let trimmed = value.trim().trim_matches(|c| c == '\'' || c == '"');
                if !trimmed.is_empty() {
                    return Ok(Some(trimmed.to_string()));
                }
            }
        }
    }
    Ok(None)
}

/// Write (or replace) a key in `<root>/.env`. Preserves other lines.
pub async fn write_env_key(root: &Path, name: &str, value: &str) -> Result<(), ApiMartError> {
    let env_path = root.join(ENV_FILE);
    let existing = fs::read_to_string(&env_path).await.ok();
    let mut lines: Vec<String> = match existing {
        Some(s) => s.lines().map(str::to_string).collect(),
        None => Vec::new(),
    };
    let mut found = false;
    for line in lines.iter_mut() {
        if let Some((line_name, _)) = line.split_once('=') {
            if line_name.trim() == name {
                *line = format!("{name}={value}");
                found = true;
            }
        }
    }
    if !found {
        lines.push(format!("{name}={value}"));
    }
    let body = lines.join("\n") + "\n";
    fs::write(&env_path, body).await.map_err(|e| ApiMartError(format!("写 .env 失败: {e}")))?;
    Ok(())
}

/// Read the project-level APIMart key from `<root>/.env`. Thin wrapper
/// over `read_env_key` kept for the existing draw command.
pub async fn read_api_key(root: &Path) -> Result<Option<String>, ApiMartError> {
    read_env_key(root, APIMART_API_KEY_NAME).await
}

/// Write or replace the project-level APIMart key. Thin wrapper over
/// `write_env_key` kept for the existing settings command.
pub async fn write_api_key(root: &Path, key: &str) -> Result<(), ApiMartError> {
    write_env_key(root, APIMART_API_KEY_NAME, key).await
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

/// Which context file a [`write_context`] call targets.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContextKind {
    Ip,
    Agents,
}

impl ContextKind {
    fn file_name(self) -> &'static str {
        match self {
            ContextKind::Ip => "ip.md",
            ContextKind::Agents => "AGENTS.md",
        }
    }
}

/// The two context files the writer page feeds to DeepSeek, plus the
/// absolute paths the UI shows next to the editor ("在改哪个文件").
#[derive(Debug, Clone, Serialize)]
pub struct Context {
    pub ip: String,
    pub agents: String,
    pub ip_path: String,
    pub agents_path: String,
}

/// Read both `ip.md` and `AGENTS.md` from `root`. Missing files come back
/// as empty strings — the writer page treats absence the same as blank.
pub async fn read_context(root: &Path) -> Result<Context, ApiMartError> {
    let ip = read_context_file(&root.join("ip.md")).await;
    let agents = read_context_file(&root.join("AGENTS.md")).await;
    Ok(Context {
        ip,
        agents,
        ip_path: root.join("ip.md").to_string_lossy().to_string(),
        agents_path: root.join("AGENTS.md").to_string_lossy().to_string(),
    })
}

async fn read_context_file(path: &Path) -> String {
    match fs::read_to_string(path).await {
        Ok(s) => s,
        Err(_) => String::new(),
    }
}

/// Overwrite one of the context files with `content` verbatim. No trim,
/// no appended newline — `git diff` should show exactly the user's edit.
pub async fn write_context(root: &Path, kind: ContextKind, content: &str) -> Result<(), ApiMartError> {
    let path = root.join(kind.file_name());
    fs::write(&path, content).await.map_err(|e| ApiMartError(format!("写 {} 失败: {e}", kind.file_name())))?;
    Ok(())
}

/// Read up to `limit` example prompt mds to feed DeepSeek as in-context
/// exemplars. The target category comes first; if it has fewer than
/// `limit`, the rest is filled from other categories (sorted by name).
/// Each example has its directive lines stripped — they're machine
/// instructions, not part of the house style.
pub async fn load_examples(root: &Path, category: &str, limit: usize) -> Result<Vec<String>, ApiMartError> {
    if limit == 0 {
        return Ok(Vec::new());
    }

    let mut target_paths: Vec<PathBuf> = Vec::new();
    let mut other_paths: Vec<PathBuf> = Vec::new();

    let mut read_dir = fs::read_dir(root).await.map_err(|e| ApiMartError(format!("读取项目目录失败: {e}")))?;
    while let Some(entry) = read_dir.next_entry().await.map_err(|e| ApiMartError(format!("读取项目目录失败: {e}")))? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let prompt_dir = path.join("prompt");
        if !prompt_dir.is_dir() {
            continue;
        }
        let category_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
        let bucket = if category_name == category { &mut target_paths } else { &mut other_paths };
        collect_prompt_mds(&prompt_dir, bucket).await?;
    }

    target_paths.sort();
    other_paths.sort();

    let mut ordered: std::iter::Chain<std::vec::IntoIter<PathBuf>, std::vec::IntoIter<PathBuf>> =
        target_paths.into_iter().chain(other_paths);

    let mut out = Vec::with_capacity(limit);
    for md_path in ordered.by_ref() {
        if out.len() >= limit {
            break;
        }
        let raw = fs::read_to_string(&md_path).await.map_err(|e| ApiMartError(format!("读取范例失败 {}: {e}", md_path.display())))?;
        let (body, _) = split_directives(&raw);
        if body.trim().is_empty() {
            continue;
        }
        out.push(body);
    }
    Ok(out)
}

async fn collect_prompt_mds(prompt_dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), ApiMartError> {
    let mut entries = fs::read_dir(prompt_dir).await.map_err(|e| ApiMartError(format!("读取 prompt 目录失败: {e}")))?;
    while let Some(entry) = entries.next_entry().await.map_err(|e| ApiMartError(format!("读取 prompt 目录失败: {e}")))? {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            out.push(path);
        }
    }
    Ok(())
}

/// Validate the file stem for a new prompt md. Keeps a card name from
/// escaping the prompt/ directory or colliding with parent traversal.
fn validate_card_name(name: &str) -> Result<(), ApiMartError> {
    if name.is_empty() {
        return Err(ApiMartError("卡名不能为空".to_string()));
    }
    if name.contains('/') || name.contains('\\') {
        return Err(ApiMartError(format!("卡名不能包含路径分隔符: {name}")));
    }
    if name.contains("..") {
        return Err(ApiMartError(format!("卡名不能包含 ..: {name}")));
    }
    Ok(())
}

/// Create a new prompt md at `<root>/<category>/prompt/<name>.md` with
/// `raw` as the bytes (verbatim — directives already in or out as the
/// caller prefers). Errors on invalid name or collision: existing files
/// are never overwritten.
pub async fn create_prompt(root: &Path, category: &str, name: &str, raw: &str) -> Result<String, ApiMartError> {
    validate_card_name(name)?;

    let prompt_dir = root.join(category).join("prompt");
    fs::create_dir_all(&prompt_dir).await.map_err(|e| ApiMartError(format!("创建 prompt 目录失败: {e}")))?;

    let md_path = prompt_dir.join(format!("{name}.md"));
    if md_path.exists() {
        return Err(ApiMartError(format!("已经有这张卡了: {name}.md")));
    }

    fs::write(&md_path, raw).await.map_err(|e| ApiMartError(format!("写 prompt 失败: {e}")))?;
    Ok(md_path.to_string_lossy().to_string())
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

    #[test]
    fn read_env_key_returns_none_when_env_file_missing() {
        let dir = tempdir();
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let result = rt.block_on(read_env_key(&dir, "DEEPSEEK_API_KEY")).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn read_env_key_returns_none_when_key_missing() {
        let dir = tempdir();
        std::fs::write(dir.join(".env"), "APIMART_API_KEY=sk-existing\n").unwrap();
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let result = rt.block_on(read_env_key(&dir, "DEEPSEEK_API_KEY")).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn read_env_key_returns_value_when_set() {
        let dir = tempdir();
        std::fs::write(dir.join(".env"), "DEEPSEEK_API_KEY=sk-deep\nAPIMART_API_KEY=sk-img\n").unwrap();
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let deepseek = rt.block_on(read_env_key(&dir, "DEEPSEEK_API_KEY")).unwrap();
        let apimart = rt.block_on(read_env_key(&dir, "APIMART_API_KEY")).unwrap();
        assert_eq!(deepseek.as_deref(), Some("sk-deep"));
        assert_eq!(apimart.as_deref(), Some("sk-img"));
    }

    #[test]
    fn write_env_key_creates_new_file_when_missing() {
        let dir = tempdir();
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(write_env_key(&dir, "DEEPSEEK_API_KEY", "sk-new")).unwrap();
        let body = std::fs::read_to_string(dir.join(".env")).unwrap();
        assert_eq!(body, "DEEPSEEK_API_KEY=sk-new\n");
    }

    #[test]
    fn write_env_key_appends_without_disturbing_other_lines() {
        let dir = tempdir();
        std::fs::write(dir.join(".env"), "APIMART_API_KEY=sk-img\n").unwrap();
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(write_env_key(&dir, "DEEPSEEK_API_KEY", "sk-deep")).unwrap();
        let body = std::fs::read_to_string(dir.join(".env")).unwrap();
        assert_eq!(body, "APIMART_API_KEY=sk-img\nDEEPSEEK_API_KEY=sk-deep\n");
    }

    #[test]
    fn write_env_key_replaces_existing_line() {
        let dir = tempdir();
        std::fs::write(dir.join(".env"), "DEEPSEEK_API_KEY=sk-old\nAPIMART_API_KEY=sk-img\n").unwrap();
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(write_env_key(&dir, "DEEPSEEK_API_KEY", "sk-new")).unwrap();
        let body = std::fs::read_to_string(dir.join(".env")).unwrap();
        assert_eq!(body, "DEEPSEEK_API_KEY=sk-new\nAPIMART_API_KEY=sk-img\n");
    }

    #[test]
    fn read_api_key_still_returns_apimart_value_after_refactor() {
        let dir = tempdir();
        std::fs::write(dir.join(".env"), "APIMART_API_KEY=sk-img\nDEEPSEEK_API_KEY=sk-deep\n").unwrap();
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let apimart = rt.block_on(read_api_key(&dir)).unwrap();
        assert_eq!(apimart.as_deref(), Some("sk-img"));
    }

    #[tokio::test]
    async fn scan_project_reports_deepseek_key_presence() {
        let root = tempdir();
        std::fs::create_dir_all(root.join("表情").join("prompt")).unwrap();
        std::fs::write(root.join("表情").join("prompt").join("00-x.md"), "").unwrap();

        let project = scan_project(&root).await.unwrap();
        assert!(!project.has_deepseek_key, "no .env → false");

        std::fs::write(root.join(".env"), "APIMART_API_KEY=sk-img\n").unwrap();
        let project = scan_project(&root).await.unwrap();
        assert!(!project.has_deepseek_key, "only APIMart key → false");

        std::fs::write(root.join(".env"), "APIMART_API_KEY=sk-img\nDEEPSEEK_API_KEY=sk-deep\n").unwrap();
        let project = scan_project(&root).await.unwrap();
        assert!(project.has_deepseek_key, "both keys → true");
    }

    #[tokio::test]
    async fn read_context_returns_empty_strings_when_files_missing() {
        let root = tempdir();
        let ctx = read_context(&root).await.unwrap();
        assert_eq!(ctx.ip, "");
        assert_eq!(ctx.agents, "");
        assert_eq!(ctx.ip_path, root.join("ip.md").to_string_lossy().to_string());
        assert_eq!(ctx.agents_path, root.join("AGENTS.md").to_string_lossy().to_string());
    }

    #[tokio::test]
    async fn read_context_returns_full_text_and_paths() {
        let root = tempdir();
        std::fs::write(root.join("ip.md"), "阿九是谁\n").unwrap();
        std::fs::write(root.join("AGENTS.md"), "# 写作规范\n四段结构\n").unwrap();
        let ctx = read_context(&root).await.unwrap();
        assert_eq!(ctx.ip, "阿九是谁\n");
        assert_eq!(ctx.agents, "# 写作规范\n四段结构\n");
    }

    #[tokio::test]
    async fn write_context_ip_writes_verbatim() {
        let root = tempdir();
        // No trailing newline — write_context must not add one.
        let body = "阿九是谁, 没有尾换行";
        write_context(&root, ContextKind::Ip, body).await.unwrap();
        let on_disk = std::fs::read(root.join("ip.md")).unwrap();
        assert_eq!(on_disk, body.as_bytes(), "bytes must match exactly");
    }

    #[tokio::test]
    async fn write_context_agents_writes_verbatim() {
        let root = tempdir();
        let body = "# 写作规范\n\n四段结构\n";
        write_context(&root, ContextKind::Agents, body).await.unwrap();
        let on_disk = std::fs::read(root.join("AGENTS.md")).unwrap();
        assert_eq!(on_disk, body.as_bytes());
    }

    #[tokio::test]
    async fn write_context_roundtrips() {
        let root = tempdir();
        let original = "原文，改一个字后还得能读回来\n第二行\n";
        std::fs::write(root.join("ip.md"), original).unwrap();
        let edited = "原文，改了两个字后还得能读回来\n第二行\n";
        write_context(&root, ContextKind::Ip, edited).await.unwrap();
        let ctx = read_context(&root).await.unwrap();
        assert_eq!(ctx.ip, edited);
        assert_eq!(std::fs::read(root.join("ip.md")).unwrap(), edited.as_bytes());
    }

    #[tokio::test]
    async fn load_examples_returns_only_target_when_enough() {
        let root = tempdir();
        for name in ["00-a", "01-b", "02-c"] {
            write_prompt_md(&root.join("表情").join("prompt"), name, "<!-- size: 1:1 -->\n<!-- resolution: 1k -->\n\n表情正文");
        }
        write_prompt_md(&root.join("动作场景").join("prompt"), "10-z", "动作正文");

        let examples = load_examples(&root, "表情", 2).await.unwrap();
        assert_eq!(examples.len(), 2);
        assert!(examples[0].contains("表情正文"));
        assert!(examples[1].contains("表情正文"));
        // Directives stripped.
        assert!(!examples.iter().any(|e| e.contains("<!-- size")));
        // Did not dip into other category.
        assert!(!examples.iter().any(|e| e.contains("动作正文")));
    }

    #[tokio::test]
    async fn load_examples_fills_from_other_categories_when_target_short() {
        let root = tempdir();
        write_prompt_md(&root.join("表情").join("prompt"), "00-a", "表情 a");
        write_prompt_md(&root.join("动作场景").join("prompt"), "01-x", "动作 x");
        write_prompt_md(&root.join("动作场景").join("prompt"), "02-y", "动作 y");

        let examples = load_examples(&root, "表情", 3).await.unwrap();
        assert_eq!(examples.len(), 3, "target had 1, top up to 3 from 动作场景");
        assert!(examples[0].contains("表情 a"));
        assert!(examples[1].contains("动作"));
        assert!(examples[2].contains("动作"));
    }

    #[tokio::test]
    async fn load_examples_returns_target_first_then_others_sorted() {
        let root = tempdir();
        write_prompt_md(&root.join("动作场景").join("prompt"), "01-x", "动作 x");
        write_prompt_md(&root.join("表情").join("prompt"), "00-a", "表情 a");
        write_prompt_md(&root.join("角色").join("prompt"), "02-z", "角色 z");

        let examples = load_examples(&root, "表情", 3).await.unwrap();
        assert_eq!(examples.len(), 3);
        // Target comes first regardless of name sort.
        assert!(examples[0].contains("表情 a"), "表情 first");
        // The other two are 动作场景 and 角色 sorted by name.
        assert!(examples[1].contains("动作") || examples[2].contains("动作"));
        assert!(examples[1].contains("角色") || examples[2].contains("角色"));
    }

    #[tokio::test]
    async fn load_examples_returns_empty_when_no_prompts() {
        let root = tempdir();
        let examples = load_examples(&root, "道具", 3).await.unwrap();
        assert!(examples.is_empty());
    }

    #[tokio::test]
    async fn create_prompt_writes_new_file_and_returns_path() {
        let root = tempdir();
        let body = "<!-- size: 1:1 -->\n<!-- resolution: 1k -->\n\n正文\n";
        let path = create_prompt(&root, "表情", "10-好奇", body).await.unwrap();
        assert!(std::path::Path::new(&path).is_file(), "file created");
        let on_disk = std::fs::read_to_string(&path).unwrap();
        assert_eq!(on_disk, body, "bytes written verbatim");
    }

    #[tokio::test]
    async fn create_prompt_creates_prompt_dir_when_missing() {
        let root = tempdir();
        // No 表情/prompt directory exists yet.
        assert!(!root.join("表情").join("prompt").is_dir());
        let path = create_prompt(&root, "表情", "00-x", "body").await.unwrap();
        assert!(root.join("表情").join("prompt").is_dir());
        assert!(std::path::Path::new(&path).is_file());
    }

    #[tokio::test]
    async fn create_prompt_rejects_empty_name() {
        let root = tempdir();
        assert!(create_prompt(&root, "表情", "", "body").await.is_err());
    }

    #[tokio::test]
    async fn create_prompt_rejects_name_with_slash() {
        let root = tempdir();
        assert!(create_prompt(&root, "表情", "10/../escape", "body").await.is_err());
        assert!(create_prompt(&root, "表情", "a/b", "body").await.is_err());
    }

    #[tokio::test]
    async fn create_prompt_rejects_name_with_backslash() {
        let root = tempdir();
        assert!(create_prompt(&root, "表情", "a\\b", "body").await.is_err());
    }

    #[tokio::test]
    async fn create_prompt_rejects_name_with_double_dot() {
        let root = tempdir();
        assert!(create_prompt(&root, "表情", "..", "body").await.is_err());
        assert!(create_prompt(&root, "表情", "a..b", "body").await.is_err());
    }

    #[tokio::test]
    async fn create_prompt_rejects_collision_and_leaves_file_untouched() {
        let root = tempdir();
        let original = "original content\n";
        let prompt_dir = root.join("表情").join("prompt");
        std::fs::create_dir_all(&prompt_dir).unwrap();
        std::fs::write(prompt_dir.join("10-好奇.md"), original).unwrap();

        let result = create_prompt(&root, "表情", "10-好奇", "new content").await;
        assert!(result.is_err());
        let body = std::fs::read_to_string(prompt_dir.join("10-好奇.md")).unwrap();
        assert_eq!(body, original, "existing file must not be overwritten");
    }

    fn write_prompt_md(dir: &Path, name: &str, body: &str) {
        std::fs::create_dir_all(dir).unwrap();
        std::fs::write(dir.join(format!("{name}.md")), body).unwrap();
    }

    fn tempdir() -> std::path::PathBuf {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("ip-creator-test-{}-{}", std::process::id(), nanos));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}