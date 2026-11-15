const COMMANDS: &[&str] = &[
    "health_check",
    "get_connection_statuses",
    "plugin_connect_server",
    "plugin_disconnect_server",
    "plugin_list_tools",
    "plugin_execute_tool",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
