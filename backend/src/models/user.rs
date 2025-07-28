use serde::{Deserialize, Serialize};
use sqlx::types::Uuid;
use time::OffsetDateTime;
use validator::Validate;
use axum::{async_trait, extract::{FromRequestParts}, http::request::Parts, http::StatusCode};
use jsonwebtoken::{decode, DecodingKey, Validation};
use crate::{services::AppState, error::AppError};

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub wallet_address: String,
    pub created_at: OffsetDateTime,
    pub role: String, // Added role field
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(length(min = 3, max = 30))]
    pub username: String,
    #[validate(length(min = 8))]
    pub password: String,
    #[validate(length(min = 42, max = 42))]
    pub wallet_address: String,
    pub role: Option<String>, // Optional role for admin creation
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

pub struct CurrentUser {
    pub user: User,
}

#[async_trait]
impl<S> FromRequestParts<S> for CurrentUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let state = state
            .downcast_ref::<AppState>()
            .ok_or_else(|| AppError::Auth("Invalid app state".to_string()))?;
        let headers = &parts.headers;
        let auth_header = headers
            .get("Authorization")
            .and_then(|h| h.to_str().ok())
            .ok_or_else(|| AppError::Auth("Missing Authorization header".to_string()))?;
        let token = auth_header.strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Auth("Invalid Authorization header format".to_string()))?;
        let claims = decode::<crate::services::auth::Claims>(
            token,
            &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| AppError::Auth("Invalid token".to_string()))?
        .claims;
        let user_id = sqlx::types::Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::Auth("Invalid user id in token".to_string()))?;
        let user = crate::db::users::get_user_by_id(&state.db, user_id)
            .await
            .map_err(|_| AppError::Auth("User not found".to_string()))?
            .ok_or_else(|| AppError::Auth("User not found".to_string()))?;
        Ok(CurrentUser { user })
    }
}
