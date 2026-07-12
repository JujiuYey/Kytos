//! Integration tests for the gacha module. These run against the real
//! `~/Desktop/角色抽卡` data — they're meant to verify that the Rust port
//! agrees with the existing Python `scripts/draw.py --dry-run` output.
//!
//! Skip everything in this file if the test data isn't present (CI machines,
//! fresh checkouts without the character project).

use std::path::PathBuf;

use app_lib::gacha::{apimart, project};

fn project_root() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let path = PathBuf::from(home).join("Desktop").join("角色抽卡");
    if path.is_dir() {
        Some(path)
    } else {
        None
    }
}

macro_rules! require_project {
    () => {
        match project_root() {
            Some(p) => p,
            None => {
                eprintln!("skipping: ~/Desktop/角色抽卡 not found");
                return;
            }
        }
    };
}

#[tokio::test]
async fn scan_project_finds_three_categories() {
    let root = require_project!();
    let project = project::scan_project(&root).await.expect("scan_project succeeds");

    let names: Vec<&str> = project.categories.iter().map(|c| c.name.as_str()).collect();
    assert_eq!(names, vec!["动作场景", "表情", "角色"], "categories sorted by name");

    let by_name: std::collections::HashMap<&str, &project::Category> =
        project.categories.iter().map(|c| (c.name.as_str(), c)).collect();

    // Cross-check against the actual filesystem.
    for (name, category) in &by_name {
        let prompt_dir = root.join(name).join("prompt");
        let expected = std::fs::read_dir(&prompt_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("md"))
            .count();
        assert_eq!(category.prompts.len(), expected, "category {name} prompt count");
    }

    // Sanity: baselines present where expected.
    assert!(project.baselines.dingzhuangzhao.is_some(), "定妆照.png present");
    assert!(project.baselines.jiaosebiao.is_some(), "角色表.png present");
}

#[tokio::test]
async fn scan_project_picks_up_image_counts() {
    let root = require_project!();
    let project = project::scan_project(&root).await.unwrap();
    let by_name: std::collections::HashMap<&str, &project::Category> =
        project.categories.iter().map(|c| (c.name.as_str(), c)).collect();

    for (name, category) in &by_name {
        for prompt in &category.prompts {
            let images_dir = root.join(name).join("images");
            let prefix = format!("{}-", prompt.name);
            let expected = std::fs::read_dir(&images_dir)
                .map(|d| {
                    d.flatten()
                        .filter(|e| {
                            let n = e.file_name().to_string_lossy().to_string();
                            n.starts_with(&prefix) && n.ends_with(".png")
                        })
                        .count()
                })
                .unwrap_or(0);
            assert_eq!(
                prompt.images.len(),
                expected,
                "prompt {}/{} image count",
                name,
                prompt.name
            );
        }
    }
}

#[tokio::test]
async fn draw_dry_run_matches_python_payload() {
    let root = require_project!();

    // Re-implement the dry-run path of `draw` without an AppHandle: read the
    // prompt, resolve the refs, build the payload, redact it. This mirrors
    // exactly what `scripts/draw.py --dry-run` produces — the integration
    // verification is "do these byte-for-byte match?".
    let md_path = root.join("表情").join("prompt").join("06-慌了.md");
    assert!(md_path.is_file(), "test prompt must exist");

    let detail = project::read_prompt(&md_path).await.unwrap();
    assert!(!detail.prompt.is_empty(), "prompt body must not be empty after stripping directives");
    assert!(!detail.prompt.contains("<!--"), "prompt body must be free of directive markers");
    assert_eq!(detail.size, "1:1", "size directive parsed from md");
    assert_eq!(detail.resolution, "1k", "resolution defaults to 1k");

    let mut references: Vec<String> = Vec::new();
    for ref_path in apimart::default_character_ref_paths(&root) {
        assert!(ref_path.is_file(), "default ref {} must exist", ref_path.display());
        references.push(apimart::load_reference(&ref_path.to_string_lossy()).unwrap());
    }
    assert_eq!(references.len(), 2, "two default character refs");

    let payload = apimart::build_payload(&detail.prompt, 1, apimart::DEFAULT_MODEL, &detail.size, &detail.resolution, &references).unwrap();
    let preview = apimart::redact_payload(&payload);

    // Field-by-field assertions matching Python's output:
    assert_eq!(preview["model"], "gpt-image-2");
    assert_eq!(preview["n"], 1);
    assert_eq!(preview["size"], "1:1");
    assert_eq!(preview["resolution"], "1k");
    assert_eq!(preview["prompt"], detail.prompt);
    assert!(preview["image_urls"].is_array());
    assert_eq!(preview["image_urls"].as_array().unwrap().len(), 2);
    for entry in preview["image_urls"].as_array().unwrap() {
        let s = entry.as_str().unwrap();
        assert!(s.starts_with("data:image/png;base64,"));
        // First 48 chars of original + `...({N} chars)`
        assert!(s.contains("chars)"), "redacted entry should contain `chars)` marker: {s}");
    }

    // The actual base64 content must match what Python would produce — they
    // both read the same files. Compare via parsed JSON values so formatting
    // differences (compact vs indent=2, etc.) don't matter.
    let mut child = std::process::Command::new("python3")
        .arg(root.join("scripts").join("draw.py"))
        .arg(&md_path)
        .arg("--dry-run")
        .current_dir(&root)
        .env("APIMART_API_KEY", "sk-dry-run-fake-key-for-byte-comparison")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .expect("python3 + scripts/draw.py must run");
    let python_stdout = child.stdout.take().unwrap();
    let python_payload_bytes = read_payload_block(python_stdout);
    let _ = child.wait();
    let python_payload = String::from_utf8(python_payload_bytes).expect("utf-8 stdout");
    let python_value: serde_json::Value = serde_json::from_str(&python_payload).expect("Python output is valid JSON");

    // Python prints `redact_payload(payload)` with indent=2 — match it exactly.
    let rust_value = apimart::redact_payload(&payload);

    assert_eq!(
        rust_value, python_value,
        "Rust redacted payload must field-for-field match Python redacted payload"
    );
}

/// `draw.py --dry-run` writes progress info to stderr and the JSON payload to
/// stdout. `stdout` here is just the JSON block, so we slurp the whole thing.
fn read_payload_block<R: std::io::Read>(mut reader: R) -> Vec<u8> {
    let mut buf = Vec::new();
    let _ = std::io::Read::read_to_end(&mut reader, &mut buf);
    buf
}

#[test]
fn unit_path_constants_align_with_python() {
    // The Python script hardcodes these strings; if we rename the project
    // structure this is the test that breaks first.
    assert_eq!(project::CHARACTER_REFS, &["角色/定妆照.png", "角色/角色表.png"]);
}

#[tokio::test]
async fn next_index_matches_existing_files_for_real_prompt() {
    let Some(root) = project_root() else { return };
    let images_dir = root.join("表情").join("images");
    let name = "06-慌了";
    let from_disk = std::fs::read_dir(&images_dir)
        .unwrap()
        .flatten()
        .filter_map(|e| {
            let n = e.file_name().to_string_lossy().to_string();
            if !n.starts_with(&format!("{name}-")) || !n.ends_with(".png") {
                return None;
            }
            n.trim_start_matches(&format!("{name}-")).trim_end_matches(".png").parse::<u32>().ok()
        })
        .max()
        .unwrap_or(0)
        + 1;
    assert_eq!(project::next_index(&images_dir, name), from_disk);
}