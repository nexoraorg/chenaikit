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
        role: &str, // Added role parameter
    ) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (id, username, password_hash, wallet_address, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, username, wallet_address, created_at, role
            "#,
            Uuid::new_v4(),
            username,
            password_hash,
            wallet_address,
            role
        )
        .fetch_one(pool)
        .await?;

        Ok(user)
    }

    pub async fn get_user_by_username(pool: &DbPool, username: &str) -> Result<Option<User>> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, username, wallet_address, created_at, role
            FROM users
            WHERE username = $1
            "#,
            username
        )
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    pub async fn get_user_by_id(pool: &DbPool, id: Uuid) -> Result<Option<User>> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, username, wallet_address, created_at, role
            FROM users
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(pool)
        .await?;
        Ok(user)
    }
}

pub mod quests {
    use super::*;
    use crate::models::Quest;
    use anyhow::Result;
    use sqlx::types::Uuid;
    use time::OffsetDateTime;

    pub async fn create_quest(
        pool: &DbPool,
        title: &str,
        description: &str,
        code_template: &str,
        tests: &str,
        requirements: &serde_json::Value,
        rewards: &serde_json::Value,
    ) -> Result<Quest> {
        let quest = sqlx::query_as!(
            Quest,
            r#"
            INSERT INTO quests (id, title, description, code_template, tests, requirements, rewards)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, title, description, code_template, tests, requirements as "requirements: _", rewards as "rewards: _", created_at, updated_at
            "#,
            Uuid::new_v4(),
            title,
            description,
            code_template,
            tests,
            requirements,
            rewards
        )
        .fetch_one(pool)
        .await?;
        Ok(quest)
    }

    pub async fn update_quest(
        pool: &DbPool,
        id: Uuid,
        title: &str,
        description: &str,
        code_template: &str,
        tests: &str,
        requirements: &serde_json::Value,
        rewards: &serde_json::Value,
    ) -> Result<Quest> {
        let quest = sqlx::query_as!(
            Quest,
            r#"
            UPDATE quests
            SET title = $2, description = $3, code_template = $4, tests = $5, requirements = $6, rewards = $7, updated_at = NOW()
            WHERE id = $1
            RETURNING id, title, description, code_template, tests, requirements as "requirements: _", rewards as "rewards: _", created_at, updated_at
            "#,
            id,
            title,
            description,
            code_template,
            tests,
            requirements,
            rewards
        )
        .fetch_one(pool)
        .await?;
        Ok(quest)
    }

    pub async fn delete_quest(pool: &DbPool, id: Uuid) -> Result<u64> {
        let result = sqlx::query!(
            "DELETE FROM quests WHERE id = $1",
            id
        )
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    pub async fn get_quest_by_id(pool: &DbPool, id: Uuid) -> Result<Option<Quest>> {
        let quest = sqlx::query_as!(
            Quest,
            r#"
            SELECT id, title, description, code_template, tests, requirements as "requirements: _", rewards as "rewards: _", created_at, updated_at
            FROM quests WHERE id = $1
            "#,
            id
        )
        .fetch_optional(pool)
        .await?;
        Ok(quest)
    }

    pub async fn list_quests(pool: &DbPool) -> Result<Vec<Quest>> {
        let quests = sqlx::query_as!(
            Quest,
            r#"
            SELECT id, title, description, code_template, tests, requirements as "requirements: _", rewards as "rewards: _", created_at, updated_at
            FROM quests
            ORDER BY created_at DESC
            "#
        )
        .fetch_all(pool)
        .await?;
        Ok(quests)
    }
}

pub mod audit_logs {
    use super::*;
    use anyhow::Result;
    use sqlx::types::Uuid;

    pub async fn insert_audit_log(
        pool: &DbPool,
        user_id: Uuid,
        quest_id: Option<Uuid>,
        action: &str,
        details: &serde_json::Value,
    ) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO audit_logs (id, user_id, quest_id, action, details)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            Uuid::new_v4(),
            user_id,
            quest_id,
            action,
            details
        )
        .execute(pool)
        .await?;
        Ok(())
    }
}
