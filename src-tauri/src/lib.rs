use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResult {
    file_name: String,
    original_name: String,
    url: String,
    size: u64,
    mime_type: String,
}

#[tauri::command]
async fn ensure_storage_structure(storage_path: String) -> Result<(), String> {
    if storage_path.is_empty() {
        return Err("存储路径未设置".to_string());
    }

    let base_dir = PathBuf::from(&storage_path);

    // 创建 data 和 uploads 子目录
    let data_dir = base_dir.join("data");
    let uploads_dir = base_dir.join("uploads");

    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("创建 data 目录失败: {}", e))?;

    fs::create_dir_all(&uploads_dir)
        .map_err(|e| format!("创建 uploads 目录失败: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn save_file_to_storage(
    file_name: String,
    file_data: Vec<u8>,
    storage_path: String,
) -> Result<UploadResult, String> {
    // 验证存储路径
    if storage_path.is_empty() {
        return Err("存储路径未设置，请先在设置中配置存储路径".to_string());
    }

    // 创建基础存储目录
    let base_storage_dir = PathBuf::from(&storage_path);

    // 创建 uploads 子目录
    let uploads_dir = base_storage_dir.join("uploads");

    // 检查目录是否存在，不存在则创建（包括父目录）
    if !uploads_dir.exists() {
        fs::create_dir_all(&uploads_dir)
            .map_err(|e| format!("创建上传目录失败: {}", e))?;
    }

    // 创建目标文件路径
    let file_path = uploads_dir.join(&file_name);

    // 写入文件
    fs::write(&file_path, file_data)
        .map_err(|e| format!("文件保存失败: {}", e))?;

    // 获取文件大小
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("无法读取文件元数据: {}", e))?;

    // 推断 MIME 类型
    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    // 构造文件 URL (Windows 路径)
    let url = format!("file:///{}", file_path.to_string_lossy().replace("\\", "/"));

    Ok(UploadResult {
        file_name: file_name.clone(),
        original_name: file_name,
        url,
        size: metadata.len(),
        mime_type,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![save_file_to_storage, ensure_storage_structure])
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
