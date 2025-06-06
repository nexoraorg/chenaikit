use anyhow::Result;
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};

pub type DbPool = Pool<Postgres>;

pub async fn create_pool(database_url: &str) -> Result<DbPool> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

pub mod users {
    use super::*;
    use crate::models::user::User;
    use anyhow::Result;
    use sqlx::types::Uuid;

    pub async fn create_user(
        pool: &DbPool,
        username: &str,
        password_hash: &str,
        wallet_address: &str,
    ) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (id, username, password_hash, wallet_address)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, wallet_address, created_at
            "#,
            Uuid::new_v4(),
            username,
            password_hash,
            wallet_address
        )
        .fetch_one(pool)
        .await?;

        Ok(user)
    }

    pub async fn get_user_by_username(pool: &DbPool, username: &str) -> Result<Option<User>> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, username, wallet_address, created_at
            FROM users
            WHERE username = $1
            "#,
            username
        )
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }
}
