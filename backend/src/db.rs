use anyhow::Result;
use sqlx::{postgres::PgPoolOptions, Pool, Postgres, types::Json};
use time::OffsetDateTime;

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

    pub async fn get_user_by_id(pool: &DbPool, user_id: Uuid) -> Result<Option<User>> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, username, wallet_address, created_at
            FROM users
            WHERE id = $1
            "#,
            user_id
        )
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    pub async fn get_password_hash(pool: &DbPool, username: &str) -> Result<Option<String>> {
        let result = sqlx::query!(
            r#"
            SELECT password_hash
            FROM users
            WHERE username = $1
            "#,
            username
        )
        .fetch_optional(pool)
        .await?;

        Ok(result.map(|r| r.password_hash))
    }
}

pub mod quests {
    use super::*;
    use crate::models::quest::{Quest, UserQuest, QuestStatus, QuestProgress, QuestRequirements, QuestRewards};
    use sqlx::types::Uuid;

    pub async fn get_all_quests(pool: &DbPool) -> Result<Vec<Quest>> {
        let quests = sqlx::query_as!(
            Quest,
            r#"
            SELECT id, title, description, requirements as "requirements: Json<QuestRequirements>",
                   rewards as "rewards: Json<QuestRewards>", created_at, updated_at
            FROM quests
            ORDER BY created_at ASC
            "#
        )
        .fetch_all(pool)
        .await?;

        Ok(quests)
    }

    pub async fn get_quest_by_id(pool: &DbPool, quest_id: Uuid) -> Result<Option<Quest>> {
        let quest = sqlx::query_as!(
            Quest,
            r#"
            SELECT id, title, description, requirements as "requirements: Json<QuestRequirements>",
                   rewards as "rewards: Json<QuestRewards>", created_at, updated_at
            FROM quests
            WHERE id = $1
            "#,
            quest_id
        )
        .fetch_optional(pool)
        .await?;

        Ok(quest)
    }

    pub async fn get_user_quest_progress(pool: &DbPool, user_id: Uuid, quest_id: Uuid) -> Result<Option<UserQuest>> {
        let user_quest = sqlx::query_as!(
            UserQuest,
            r#"
            SELECT id, user_id, quest_id, status as "status: QuestStatus",
                   progress as "progress: Json<QuestProgress>", completed_at, created_at, updated_at
            FROM user_quests
            WHERE user_id = $1 AND quest_id = $2
            "#,
            user_id,
            quest_id
        )
        .fetch_optional(pool)
        .await?;

        Ok(user_quest)
    }

    pub async fn get_all_user_quest_progress(pool: &DbPool, user_id: Uuid) -> Result<Vec<UserQuest>> {
        let user_quests = sqlx::query_as!(
            UserQuest,
            r#"
            SELECT id, user_id, quest_id, status as "status: QuestStatus",
                   progress as "progress: Json<QuestProgress>", completed_at, created_at, updated_at
            FROM user_quests
            WHERE user_id = $1
            ORDER BY created_at ASC
            "#,
            user_id
        )
        .fetch_all(pool)
        .await?;

        Ok(user_quests)
    }

    pub async fn start_quest(pool: &DbPool, user_id: Uuid, quest_id: Uuid) -> Result<UserQuest> {
        let user_quest = sqlx::query_as!(
            UserQuest,
            r#"
            INSERT INTO user_quests (id, user_id, quest_id, status, progress)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, user_id, quest_id, status as "status: QuestStatus",
                      progress as "progress: Json<QuestProgress>", completed_at, created_at, updated_at
            "#,
            Uuid::new_v4(),
            user_id,
            quest_id,
            QuestStatus::InProgress as QuestStatus,
            Json(QuestProgress::default())
        )
        .fetch_one(pool)
        .await?;

        Ok(user_quest)
    }

    pub async fn update_quest_progress(
        pool: &DbPool,
        user_id: Uuid,
        quest_id: Uuid,
        progress: QuestProgress
    ) -> Result<UserQuest> {
        let user_quest = sqlx::query_as!(
            UserQuest,
            r#"
            UPDATE user_quests
            SET progress = $3, updated_at = NOW()
            WHERE user_id = $1 AND quest_id = $2
            RETURNING id, user_id, quest_id, status as "status: QuestStatus",
                      progress as "progress: Json<QuestProgress>", completed_at, created_at, updated_at
            "#,
            user_id,
            quest_id,
            Json(progress)
        )
        .fetch_one(pool)
        .await?;

        Ok(user_quest)
    }

    pub async fn complete_quest(pool: &DbPool, user_id: Uuid, quest_id: Uuid) -> Result<UserQuest> {
        let user_quest = sqlx::query_as!(
            UserQuest,
            r#"
            UPDATE user_quests
            SET status = $3, completed_at = NOW(), updated_at = NOW()
            WHERE user_id = $1 AND quest_id = $2
            RETURNING id, user_id, quest_id, status as "status: QuestStatus",
                      progress as "progress: Json<QuestProgress>", completed_at, created_at, updated_at
            "#,
            user_id,
            quest_id,
            QuestStatus::Completed as QuestStatus
        )
        .fetch_one(pool)
        .await?;

        Ok(user_quest)
    }
}

pub mod nfts {
    use super::*;
    use crate::models::nft::{NFTMetadata, NFTType, NFTMetadataContent};
    use sqlx::types::Uuid;

    pub async fn get_user_nfts(pool: &DbPool, user_id: Uuid) -> Result<Vec<NFTMetadata>> {
        let nfts = sqlx::query_as!(
            NFTMetadata,
            r#"
            SELECT id, token_id, token_type as "token_type: NFTType", owner_id,
                   metadata as "metadata: Json<NFTMetadataContent>", created_at, updated_at
            FROM nft_metadata
            WHERE owner_id = $1
            ORDER BY created_at ASC
            "#,
            user_id
        )
        .fetch_all(pool)
        .await?;

        Ok(nfts)
    }

    pub async fn get_user_character_nft(pool: &DbPool, user_id: Uuid) -> Result<Option<NFTMetadata>> {
        let nft = sqlx::query_as!(
            NFTMetadata,
            r#"
            SELECT id, token_id, token_type as "token_type: NFTType", owner_id,
                   metadata as "metadata: Json<NFTMetadataContent>", created_at, updated_at
            FROM nft_metadata
            WHERE owner_id = $1 AND token_type = 'character'
            LIMIT 1
            "#,
            user_id
        )
        .fetch_optional(pool)
        .await?;

        Ok(nft)
    }

    pub async fn get_user_badges(pool: &DbPool, user_id: Uuid) -> Result<Vec<NFTMetadata>> {
        let badges = sqlx::query_as!(
            NFTMetadata,
            r#"
            SELECT id, token_id, token_type as "token_type: NFTType", owner_id,
                   metadata as "metadata: Json<NFTMetadataContent>", created_at, updated_at
            FROM nft_metadata
            WHERE owner_id = $1 AND token_type = 'badge'
            ORDER BY created_at ASC
            "#,
            user_id
        )
        .fetch_all(pool)
        .await?;

        Ok(badges)
    }

    pub async fn create_nft(
        pool: &DbPool,
        token_id: i64,
        token_type: NFTType,
        owner_id: Uuid,
        metadata: NFTMetadataContent,
    ) -> Result<NFTMetadata> {
        let nft = sqlx::query_as!(
            NFTMetadata,
            r#"
            INSERT INTO nft_metadata (id, token_id, token_type, owner_id, metadata)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, token_id, token_type as "token_type: NFTType", owner_id,
                      metadata as "metadata: Json<NFTMetadataContent>", created_at, updated_at
            "#,
            Uuid::new_v4(),
            token_id,
            token_type as NFTType,
            owner_id,
            Json(metadata)
        )
        .fetch_one(pool)
        .await?;

        Ok(nft)
    }
}

pub mod progress {
    use super::*;
    use crate::models::{
        quest::{QuestStatus},
        progress::{OverallStats},
    };
    use sqlx::types::Uuid;

    pub async fn get_user_overall_stats(pool: &DbPool, user_id: Uuid) -> Result<OverallStats> {
        let stats = sqlx::query!(
            r#"
            SELECT
                COALESCE(SUM(CASE WHEN uq.status = 'completed' THEN 1 ELSE 0 END), 0) as completed_quests,
                COALESCE(SUM(CASE WHEN uq.status = 'in_progress' THEN 1 ELSE 0 END), 0) as in_progress_quests,
                COALESCE(COUNT(nm.id) FILTER (WHERE nm.token_type = 'badge'), 0) as badge_count,
                COALESCE(MAX(uq.completed_at), NULL) as last_activity
            FROM users u
            LEFT JOIN user_quests uq ON u.id = uq.user_id
            LEFT JOIN nft_metadata nm ON u.id = nm.owner_id
            WHERE u.id = $1
            GROUP BY u.id
            "#,
            user_id
        )
        .fetch_one(pool)
        .await?;

        // Calculate derived stats
        let total_quests = stats.completed_quests + stats.in_progress_quests;
        let completion_rate = if total_quests > 0 {
            stats.completed_quests as f32 / total_quests as f32 * 100.0
        } else {
            0.0
        };

        // For now, use simple formulas - these could be more sophisticated
        let total_experience = stats.completed_quests as u32 * 100; // 100 XP per quest
        let level = (total_experience / 1000) + 1; // Level up every 1000 XP

        Ok(OverallStats {
            total_experience,
            level,
            quests_completed: stats.completed_quests as u32,
            quests_in_progress: stats.in_progress_quests as u32,
            badges_earned: stats.badge_count as u32,
            skills_unlocked: stats.completed_quests as u32, // Simplified: 1 skill per quest
            total_time_spent_hours: 0.0, // TODO: Calculate from quest progress
            completion_rate,
            streak_days: 0, // TODO: Calculate streak
            last_activity: stats.last_activity,
        })
    }

    pub async fn get_quest_completion_stats(pool: &DbPool, user_id: Uuid) -> Result<(u32, f32)> {
        let stats = sqlx::query!(
            r#"
            SELECT
                COUNT(q.id) as total_quests,
                COALESCE(SUM(CASE WHEN uq.status = 'completed' THEN 1 ELSE 0 END), 0) as completed_quests
            FROM quests q
            LEFT JOIN user_quests uq ON q.id = uq.quest_id AND uq.user_id = $1
            "#,
            user_id
        )
        .fetch_one(pool)
        .await?;

        let total = stats.total_quests as u32;
        let completed = stats.completed_quests as u32;
        let percentage = if total > 0 {
            completed as f32 / total as f32 * 100.0
        } else {
            0.0
        };

        Ok((total, percentage))
    }
}
