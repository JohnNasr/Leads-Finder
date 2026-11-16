use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "store.json";
const TOKEN_KEY: &str = "apify_token";
const LLM_API_KEY: &str = "llm_api_key";
const LLM_PROVIDER: &str = "llm_provider";
const ICP_CONFIG: &str = "icp_config";

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

#[tauri::command]
async fn get_llm_api_key(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store
        .get(LLM_API_KEY)
        .and_then(|v| v.as_str().map(str::to_owned))
        .filter(|t| !t.is_empty()))
}

#[tauri::command]
async fn set_llm_api_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(LLM_API_KEY, key);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_llm_provider(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store
        .get(LLM_PROVIDER)
        .and_then(|v| v.as_str().map(str::to_owned))
        .filter(|t| !t.is_empty()))
}

#[tauri::command]
async fn set_llm_provider(app: tauri::AppHandle, provider: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(LLM_PROVIDER, provider);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_icp_config(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store
        .get(ICP_CONFIG)
        .and_then(|v| v.as_str().map(str::to_owned))
        .filter(|t| !t.is_empty()))
}

#[tauri::command]
async fn set_icp_config(app: tauri::AppHandle, config: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(ICP_CONFIG, config);
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

#[tauri::command]
async fn get_store_value(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store
        .get(&key)
        .and_then(|v| v.as_str().map(str::to_owned))
        .filter(|t| !t.is_empty()))
}

#[tauri::command]
async fn set_store_value(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(key, value);
    store.save().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_mcp_client::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_api_token,
            set_api_token,
            get_llm_api_key,
            set_llm_api_key,
            get_llm_provider,
            set_llm_provider,
            get_icp_config,
            set_icp_config,
            get_store_value,
            set_store_value,
            set_apify_env
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
