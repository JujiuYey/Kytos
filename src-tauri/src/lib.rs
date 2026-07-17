use serde::{Deserialize, Serialize};

pub mod gacha;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      gacha::scan_project,
      gacha::read_prompt,
      gacha::write_prompt,
      gacha::set_baseline,
      gacha::read_api_key,
      gacha::write_api_key,
      gacha::delete_api_key,
      gacha::read_env_key,
      gacha::write_env_key,
      gacha::delete_env_key,
      gacha::draw,
      gacha::fetch_task,
      gacha::chat_ip,
      gacha::summarize_ip,
      gacha::read_context,
      gacha::write_context,
      gacha::generate_prompt,
      gacha::create_prompt,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResult {
    file_name: String,
    original_name: String,
    url: String,
    size: u64,
    mime_type: String,
}
