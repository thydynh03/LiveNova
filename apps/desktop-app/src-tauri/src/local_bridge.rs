use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_tungstenite::accept_async;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeStatus {
    pub is_running: bool,
    pub port: u16,
    pub session_token: String,
    pub connected_clients: usize,
}

#[derive(Clone)]
pub struct BridgeState {
    pub is_running: Arc<Mutex<bool>>,
    pub port: u16,
    pub session_token: String,
    pub connected_clients: Arc<Mutex<usize>>,
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(Mutex::new(false)),
            port: 4000,
            session_token: Uuid::new_v4().to_string(),
            connected_clients: Arc::new(Mutex::new(0)),
        }
    }

    pub async fn get_status(&self) -> BridgeStatus {
        BridgeStatus {
            is_running: *self.is_running.lock().await,
            port: self.port,
            session_token: self.session_token.clone(),
            connected_clients: *self.connected_clients.lock().await,
        }
    }
}

pub async fn start_server(
    state: BridgeState,
    _app_handle: tauri::AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    let addr = format!("127.0.0.1:{}", state.port);
    let listener = TcpListener::bind(&addr).await?;

    *state.is_running.lock().await = true;
    tracing::info!("Local Bridge running on {}", addr);
    tracing::info!("Session Token: {}", state.session_token);

    while let Ok((stream, _)) = listener.accept().await {
        let state_clone = state.clone();
        tokio::spawn(async move {
            let mut clients_guard = state_clone.connected_clients.lock().await;
            *clients_guard += 1;
            drop(clients_guard);

            if let Ok(mut ws_stream) = accept_async(stream).await {
                while let Some(msg) = ws_stream.next().await {
                    match msg {
                        Ok(msg) => {
                            if msg.is_text() {
                                // Basic echo or auth processing here
                                tracing::debug!("Received WS message");
                            }
                        }
                        Err(e) => {
                            tracing::error!("WebSocket error: {}", e);
                            break;
                        }
                    }
                }
            }

            let mut clients_guard = state_clone.connected_clients.lock().await;
            if *clients_guard > 0 {
                *clients_guard -= 1;
            }
        });
    }

    Ok(())
}
