use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;
use serde::Deserialize;
use validator::Validate;

use crate::{error::AppError, services::AppState, models::{Quest, CurrentUser}};
use crate::db::quests as quest_db;
use crate::db::audit_logs as audit_db;

#[derive(Debug, Deserialize, Validate)]
pub struct QuestRequest {
    #[validate(length(min = 1))]
    pub title: String,
    #[validate(length(min = 1))]
    pub description: String,
    #[validate(length(min = 1))]
    pub code_template: String,
    #[validate(length(min = 1))]
    pub tests: String,
    pub requirements: serde_json::Value,
    pub rewards: serde_json::Value,
}

pub async fn list_quests(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let quests = quest_db::list_quests(&state.db).await?;
    Ok(Json(serde_json::json!({ "quests": quests })))
}

pub async fn get_quest(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let quest = quest_db::get_quest_by_id(&state.db, id).await?;
    Ok(Json(serde_json::json!({ "quest": quest })))
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

pub async fn create_quest(
    State(state): State<AppState>,
    current_user: CurrentUser,
    Json(payload): Json<QuestRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if current_user.user.role != "admin" {
        return Err(AppError::Auth("Admin access required".to_string()));
    }
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let quest = quest_db::create_quest(
        &state.db,
        &payload.title,
        &payload.description,
        &payload.code_template,
        &payload.tests,
        &payload.requirements,
        &payload.rewards,
    ).await?;
    // Audit log
    let details = serde_json::json!({"input": &payload, "result": &quest});
    audit_db::insert_audit_log(
        &state.db,
        current_user.user.id,
        Some(quest.id),
        "create",
        &details,
    ).await?;
    Ok(Json(serde_json::json!({"quest": quest})))
}

pub async fn update_quest(
    State(state): State<AppState>,
    current_user: CurrentUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<QuestRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if current_user.user.role != "admin" {
        return Err(AppError::Auth("Admin access required".to_string()));
    }
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let quest = quest_db::update_quest(
        &state.db,
        id,
        &payload.title,
        &payload.description,
        &payload.code_template,
        &payload.tests,
        &payload.requirements,
        &payload.rewards,
    ).await?;
    // Audit log
    let details = serde_json::json!({"input": &payload, "result": &quest});
    audit_db::insert_audit_log(
        &state.db,
        current_user.user.id,
        Some(id),
        "update",
        &details,
    ).await?;
    Ok(Json(serde_json::json!({"quest": quest})))
}

pub async fn delete_quest(
    State(state): State<AppState>,
    current_user: CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    if current_user.user.role != "admin" {
        return Err(AppError::Auth("Admin access required".to_string()));
    }
    let deleted = quest_db::delete_quest(&state.db, id).await?;
    // Audit log
    let details = serde_json::json!({"deleted": deleted > 0});
    audit_db::insert_audit_log(
        &state.db,
        current_user.user.id,
        Some(id),
        "delete",
        &details,
    ).await?;
    Ok(Json(serde_json::json!({"deleted": deleted > 0})))
}
