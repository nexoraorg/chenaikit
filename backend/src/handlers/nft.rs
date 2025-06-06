use axum::{
    extract::{Path, State},
    Json,
};

use crate::{error::AppError, services::AppState};

pub async fn get_metadata(
    State(_state): State<AppState>,
    Path(_token_id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "metadata": null
    })))
}

pub async fn mint_nft(State(_state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "status": "minted",
        "token_id": null
    })))
}

pub async fn transfer_nft(
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "status": "transferred"
    })))
}
