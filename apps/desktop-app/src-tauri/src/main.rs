// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod key_simulator;
mod local_bridge;
mod obs_controller;
mod rcon_client;

use tauri::Manager;
use tracing_subscriber::EnvFilter;

#[tauri::command]
async fn get_bridge_status(
    state: tauri::State<'_, local_bridge::BridgeState>,
) -> Result<local_bridge::BridgeStatus, String> {
    Ok(state.get_status().await)
}

#[tauri::command]
async fn connect_obs(host: String, port: u16, password: Option<String>) -> Result<bool, String> {
    obs_controller::connect(&host, port, password.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_rcon_command(
    host: String,
    port: u16,
    password: String,
    command: String,
) -> Result<String, String> {
    rcon_client::execute(&host, port, &password, &command)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn simulate_key_press(key_code: u16, hold_ms: u64) -> Result<(), String> {
    key_simulator::press_key(key_code, hold_ms).map_err(|e| e.to_string())
}

fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("tiktok_live_desktop=info".parse().unwrap()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Start Local Bridge WebSocket Server
            let bridge_state = local_bridge::BridgeState::new();
            let bridge_clone = bridge_state.clone();
            app.manage(bridge_state);

            tokio::spawn(async move {
                if let Err(e) = local_bridge::start_server(bridge_clone, app_handle).await {
                    tracing::error!("Local Bridge failed: {}", e);
                }
            });

            tracing::info!("TikTok LIVE Desktop started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bridge_status,
            connect_obs,
            send_rcon_command,
            simulate_key_press,
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
