use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;
use tauri::{Emitter, Manager, State};
use url::Url;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FilePayload {
    pub path: String,
    pub name: String,
    pub content: String,
    pub size: u64,
    pub last_modified: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VaultItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<VaultItem>>,
}

pub struct AppState {
    pub initial_file: Arc<Mutex<Option<String>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            initial_file: Arc::new(Mutex::new(None)),
        }
    }
}

fn read_file_payload(file_path: &Path) -> Result<FilePayload, String> {
    let metadata = fs::metadata(file_path).map_err(|e| format!("Failed to read metadata: {}", e))?;
    let content = fs::read_to_string(file_path).map_err(|e| format!("Failed to read file content: {}", e))?;
    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled.md".to_string());
    let path = file_path.to_string_lossy().to_string();
    let size = metadata.len();
    let last_modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(FilePayload {
        path,
        name,
        content,
        size,
        last_modified,
    })
}

#[tauri::command]
fn read_file(path: String) -> Result<FilePayload, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    read_file_payload(&p)
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<FilePayload, String> {
    let p = PathBuf::from(&path);
    fs::write(&p, content.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))?;
    read_file_payload(&p)
}

#[tauri::command]
fn open_file_dialog() -> Result<Option<FilePayload>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("Markdown & Text", &["md", "markdown", "mdown", "mkd", "txt"])
        .add_filter("All Files", &["*"])
        .set_title("Open Markdown File")
        .pick_file();

    match file {
        Some(path_buf) => {
            let payload = read_file_payload(&path_buf)?;
            Ok(Some(payload))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn open_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Obsidian Vault フォルダを選択")
        .pick_folder();

    match folder {
        Some(path_buf) => Ok(Some(path_buf.to_string_lossy().to_string())),
        None => Ok(None),
    }
}

fn scan_dir_recursive(dir: &Path) -> Result<Vec<VaultItem>, String> {
    let mut items = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read dir: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // Ignore hidden files and system/build dirs
            if name.starts_with('.') || name == "node_modules" || name == ".trash" || name == ".obsidian" {
                continue;
            }

            if path.is_dir() {
                let children = scan_dir_recursive(&path)?;
                items.push(VaultItem {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    children: Some(children),
                });
            } else {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                if ["md", "markdown", "txt", "png", "jpg", "jpeg", "gif", "svg", "webp"].contains(&ext.as_str()) {
                    items.push(VaultItem {
                        name,
                        path: path.to_string_lossy().to_string(),
                        is_dir: false,
                        children: None,
                    });
                }
            }
        }
    }

    // Sort: directories first, then alphabetically
    items.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(items)
}

#[tauri::command]
fn read_vault_tree(vault_path: String) -> Result<Vec<VaultItem>, String> {
    let p = PathBuf::from(&vault_path);
    if !p.exists() || !p.is_dir() {
        return Err(format!("Vault directory does not exist: {}", vault_path));
    }
    scan_dir_recursive(&p)
}

#[tauri::command]
fn read_file_as_data_url(file_path: String) -> Result<String, String> {
    let p = PathBuf::from(&file_path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    };
    let data = fs::read(&p).map_err(|e| format!("Failed to read file: {}", e))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn save_file_as_dialog(default_name: Option<String>, content: String) -> Result<Option<FilePayload>, String> {
    let default_file = default_name.unwrap_or_else(|| "document.md".to_string());
    let file = rfd::FileDialog::new()
        .add_filter("Markdown Document", &["md", "markdown"])
        .set_file_name(&default_file)
        .set_title("Save Markdown File")
        .save_file();

    match file {
        Some(path_buf) => {
            fs::write(&path_buf, content.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))?;
            let payload = read_file_payload(&path_buf)?;
            Ok(Some(payload))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn export_html_file_dialog(default_name: Option<String>, html_content: String) -> Result<Option<String>, String> {
    let default_file = default_name.unwrap_or_else(|| "export.html".to_string());
    let file = rfd::FileDialog::new()
        .add_filter("HTML Document", &["html", "htm"])
        .set_file_name(&default_file)
        .set_title("Export as HTML")
        .save_file();

    match file {
        Some(path_buf) => {
            fs::write(&path_buf, html_content.as_bytes()).map_err(|e| format!("Failed to write HTML file: {}", e))?;
            Ok(Some(path_buf.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn move_to_vault(current_path: Option<String>, vault_path: String, file_name: String, content: String) -> Result<FilePayload, String> {
    let vault_dir = PathBuf::from(&vault_path);
    if !vault_dir.exists() || !vault_dir.is_dir() {
        return Err(format!("Vault directory does not exist: {}", vault_path));
    }

    let clean_name = if file_name.ends_with(".md") || file_name.ends_with(".markdown") || file_name.ends_with(".txt") {
        file_name
    } else {
        format!("{}.md", file_name)
    };

    let target_path = vault_dir.join(&clean_name);

    // If source file exists outside vault, remove the old file if it was a real file on disk
    if let Some(old_p_str) = current_path {
        let old_p = PathBuf::from(&old_p_str);
        if old_p.exists() && old_p.is_file() && old_p != target_path {
            let _ = fs::remove_file(&old_p);
        }
    }

    // Write content to target path in vault
    fs::write(&target_path, content.as_bytes()).map_err(|e| format!("Failed to write file to vault: {}", e))?;
    read_file_payload(&target_path)
}

#[tauri::command]
fn show_in_finder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn get_initial_file(state: State<'_, AppState>) -> Result<Option<FilePayload>, String> {
    let initial = state.initial_file.lock().unwrap().clone();
    if let Some(path_str) = initial {
        let p = PathBuf::from(&path_str);
        if p.exists() {
            return Ok(Some(read_file_payload(&p)?));
        }
    }
    Ok(None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_file_state = Arc::new(Mutex::new(None));

    // Check CLI args on cold start
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let potential_path = &args[1];
        let p = PathBuf::from(potential_path);
        if p.exists() && p.is_file() {
            *initial_file_state.lock().unwrap() = Some(p.to_string_lossy().to_string());
        }
    }

    let initial_file_clone = initial_file_state.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            initial_file: initial_file_state,
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            save_file,
            open_file_dialog,
            open_folder_dialog,
            read_vault_tree,
            read_file_as_data_url,
            move_to_vault,
            save_file_as_dialog,
            export_html_file_dialog,
            show_in_finder,
            get_initial_file
        ])
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app_handle, event| match event {
        tauri::RunEvent::Opened { urls } => {
            for url in urls {
                let file_path = if let Ok(parsed_url) = Url::parse(url.as_str()) {
                    parsed_url.to_file_path().ok().map(|p| p.to_string_lossy().to_string())
                } else {
                    let path_str = url.as_str();
                    if let Some(stripped) = path_str.strip_prefix("file://") {
                        Some(stripped.to_string())
                    } else {
                        Some(path_str.to_string())
                    }
                };

                if let Some(path) = file_path {
                    let p = PathBuf::from(&path);
                    if p.exists() && p.is_file() {
                        *initial_file_clone.lock().unwrap() = Some(path.clone());
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.emit("open-file-event", path);
                        }
                    }
                }
            }
        }
        _ => {}
    });
}
