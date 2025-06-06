use crate::{
    models::user::{CreateUserRequest, LoginRequest},
    services::{self, AppState},
};
use axum::{extract::State, Json};

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<_>, crate::error::AppError> {
    let response = services::auth::register(&state, req).await?;
    Ok(Json(response))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<_>, crate::error::AppError> {
    let response = services::auth::login(&state, req).await?;
    Ok(Json(response))
}
