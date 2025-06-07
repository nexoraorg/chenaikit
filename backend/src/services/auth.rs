use crate::{
    db::users,
    error::AppError,
    models::user::{AuthResponse, CreateUserRequest, LoginRequest, User},
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use time::{Duration, OffsetDateTime};
use validator::Validate;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
}

pub async fn register(
    state: &crate::services::AppState,
    req: CreateUserRequest,
) -> Result<AuthResponse, AppError> {
    // Validate request
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Check if user exists
    if users::get_user_by_username(&state.db, &req.username)
        .await?
        .is_some()
    {
        return Err(AppError::Validation("Username already taken".into()));
    }

    // Hash password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(e.into()))?
        .to_string();

    // Create user
    let user = users::create_user(
        &state.db,
        &req.username,
        &password_hash,
        &req.wallet_address,
    )
    .await?;

    // Generate JWT
    let token = create_token(&user, &state.config.jwt_secret)?;

    Ok(AuthResponse { token, user })
}

pub async fn login(
    state: &crate::services::AppState,
    req: LoginRequest,
) -> Result<AuthResponse, AppError> {
    // Validate request
    req.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Get user
    let user = users::get_user_by_username(&state.db, &req.username)
        .await?
        .ok_or_else(|| AppError::Auth("Invalid credentials".into()))?;

    // Verify password
    let parsed_hash = PasswordHash::new(&req.password).map_err(|e| AppError::Internal(e.into()))?;

    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Auth("Invalid credentials".into()))?;

    // Generate JWT
    let token = create_token(&user, &state.config.jwt_secret)?;

    Ok(AuthResponse { token, user })
}

fn create_token(user: &User, secret: &str) -> Result<String, AppError> {
    let expiration = OffsetDateTime::now_utc() + Duration::days(7);

    let claims = Claims {
        sub: user.id.to_string(),
        exp: expiration.unix_timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(e.into()))
}
