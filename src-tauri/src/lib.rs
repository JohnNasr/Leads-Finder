use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "store.json";
const TOKEN_KEY: &str = "apify_token";

#[tauri::command]
async fn get_api_token(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store
        .get(TOKEN_KEY)
        .and_then(|v| v.as_str().map(str::to_owned))
        .filter(|t| !t.is_empty()))
}

#[tauri::command]
async fn set_api_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(TOKEN_KEY, token);
    store.save().map_err(|e| e.to_string())
}

// The MCP plugin spawns servers with this process's environment and has no env option.
#[tauri::command]
fn set_apify_env(token: String) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("Apify API token is empty".into());
    }
    std::env::set_var("APIFY_TOKEN", token.trim());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_mcp_client::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_api_token,
            set_api_token,
            set_apify_env
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
