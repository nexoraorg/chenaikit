use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use crate::{error::AppError, services::AppState};

pub async fn list_quests(
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "quests": []
    })))
}

pub async fn get_quest(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "quest": null
    })))
}

pub async fn start_quest(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "status": "started"
    })))
}

pub async fn complete_quest(
    State(_state): State<AppState>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "status": "completed"
    })))
}
