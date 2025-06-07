use axum::Json;
use serde_json::json;

pub async fn check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "message": "Service is healthy"
    }))
}
