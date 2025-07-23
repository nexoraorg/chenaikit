use sqlx::{PgPool, Row};
use uuid::Uuid;
use time::OffsetDateTime;
use std::collections::HashMap;

use crate::{
    db,
    models::{
        user::User,
        quest::{Quest, UserQuest, QuestStatus, QuestProgress, QuestRequirements, QuestRewards},
        nft::{NFTMetadata, NFTType, NFTMetadataContent},
        progress::OverallStats,
    },
    services::{skill_tree::SkillTreeService, cache::CacheService},
};

pub mod progress_tests;
pub mod skill_tree_tests;
pub mod cache_tests;
pub mod integration_tests;

// Test utilities
pub struct TestContext {
    pub pool: PgPool,
    pub cache: CacheService,
    pub test_user: User,
    pub test_quests: Vec<Quest>,
}

impl TestContext {
    pub async fn new() -> Self {
        let database_url = std::env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgres://test:test@localhost/skillsig_test".to_string());
        
        let pool = sqlx::PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        let redis_url = std::env::var("TEST_REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379/1".to_string());
        
        let redis_client = redis::Client::open(redis_url)
            .expect("Failed to connect to test Redis");
        
        let cache = CacheService::new(redis_client);

        let test_user = create_test_user(&pool).await;
        let test_quests = create_test_quests(&pool).await;

        Self {
            pool,
            cache,
            test_user,
            test_quests,
        }
    }

    pub async fn cleanup(&self) {
        // Clean up test data
        sqlx::query!("DELETE FROM user_quests WHERE user_id = $1", self.test_user.id)
            .execute(&self.pool)
            .await
            .ok();

        sqlx::query!("DELETE FROM nft_metadata WHERE owner_id = $1", self.test_user.id)
            .execute(&self.pool)
            .await
            .ok();

        sqlx::query!("DELETE FROM users WHERE id = $1", self.test_user.id)
            .execute(&self.pool)
            .await
            .ok();

        for quest in &self.test_quests {
            sqlx::query!("DELETE FROM quests WHERE id = $1", quest.id)
                .execute(&self.pool)
                .await
                .ok();
        }

        // Clear cache
        let _ = self.cache.invalidate_user_caches(self.test_user.id).await;
    }
}

async fn create_test_user(pool: &PgPool) -> User {
    let user_id = Uuid::new_v4();
    let username = format!("test_user_{}", user_id);
    let wallet_address = format!("0x{:040x}", rand::random::<u128>());

    sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (id, username, password_hash, wallet_address)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, wallet_address, created_at
        "#,
        user_id,
        username,
        "test_password_hash",
        wallet_address
    )
    .fetch_one(pool)
    .await
    .expect("Failed to create test user")
}

async fn create_test_quests(pool: &PgPool) -> Vec<Quest> {
    let mut quests = Vec::new();

    // Create a series of interconnected quests
    let quest1_id = Uuid::new_v4();
    let quest2_id = Uuid::new_v4();
    let quest3_id = Uuid::new_v4();

    // Quest 1: HTML Basics (no prerequisites)
    let quest1 = sqlx::query_as!(
        Quest,
        r#"
        INSERT INTO quests (id, title, description, requirements, rewards)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, description, 
                  requirements as "requirements: sqlx::types::Json<QuestRequirements>",
                  rewards as "rewards: sqlx::types::Json<QuestRewards>",
                  created_at, updated_at
        "#,
        quest1_id,
        "HTML Basics",
        "Learn the fundamentals of HTML",
        sqlx::types::Json(QuestRequirements {
            skill_level: None,
            prerequisites: vec![],
            skills_required: vec![],
            min_badges: None,
        }),
        sqlx::types::Json(QuestRewards {
            experience_points: 100,
            badge_name: "HTML Master".to_string(),
            badge_description: "Completed HTML basics quest".to_string(),
            skills_unlocked: vec!["html".to_string()],
            next_quests: vec![quest2_id],
        })
    )
    .fetch_one(pool)
    .await
    .expect("Failed to create quest 1");

    // Quest 2: CSS Styling (requires Quest 1)
    let quest2 = sqlx::query_as!(
        Quest,
        r#"
        INSERT INTO quests (id, title, description, requirements, rewards)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, description, 
                  requirements as "requirements: sqlx::types::Json<QuestRequirements>",
                  rewards as "rewards: sqlx::types::Json<QuestRewards>",
                  created_at, updated_at
        "#,
        quest2_id,
        "CSS Styling",
        "Master CSS for beautiful web pages",
        sqlx::types::Json(QuestRequirements {
            skill_level: None,
            prerequisites: vec![quest1_id],
            skills_required: vec!["html".to_string()],
            min_badges: None,
        }),
        sqlx::types::Json(QuestRewards {
            experience_points: 150,
            badge_name: "CSS Wizard".to_string(),
            badge_description: "Completed CSS styling quest".to_string(),
            skills_unlocked: vec!["css".to_string()],
            next_quests: vec![quest3_id],
        })
    )
    .fetch_one(pool)
    .await
    .expect("Failed to create quest 2");

    // Quest 3: JavaScript Programming (requires Quest 2)
    let quest3 = sqlx::query_as!(
        Quest,
        r#"
        INSERT INTO quests (id, title, description, requirements, rewards)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, description, 
                  requirements as "requirements: sqlx::types::Json<QuestRequirements>",
                  rewards as "rewards: sqlx::types::Json<QuestRewards>",
                  created_at, updated_at
        "#,
        quest3_id,
        "JavaScript Programming",
        "Learn dynamic web programming with JavaScript",
        sqlx::types::Json(QuestRequirements {
            skill_level: Some(2),
            prerequisites: vec![quest2_id],
            skills_required: vec!["html".to_string(), "css".to_string()],
            min_badges: Some(2),
        }),
        sqlx::types::Json(QuestRewards {
            experience_points: 200,
            badge_name: "JS Developer".to_string(),
            badge_description: "Completed JavaScript programming quest".to_string(),
            skills_unlocked: vec!["javascript".to_string()],
            next_quests: vec![],
        })
    )
    .fetch_one(pool)
    .await
    .expect("Failed to create quest 3");

    quests.push(quest1);
    quests.push(quest2);
    quests.push(quest3);

    quests
}

pub async fn create_test_user_quest(
    pool: &PgPool,
    user_id: Uuid,
    quest_id: Uuid,
    status: QuestStatus,
    completion_percentage: f32,
) -> UserQuest {
    let progress = QuestProgress {
        steps_completed: vec!["step1".to_string()],
        current_step: Some("step2".to_string()),
        completion_percentage,
        attempts: 1,
        hints_used: 0,
        time_spent_minutes: 30,
        custom_data: HashMap::new(),
    };

    let completed_at = if status == QuestStatus::Completed {
        Some(OffsetDateTime::now_utc())
    } else {
        None
    };

    sqlx::query_as!(
        UserQuest,
        r#"
        INSERT INTO user_quests (id, user_id, quest_id, status, progress, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id, quest_id, 
                  status as "status: QuestStatus",
                  progress as "progress: sqlx::types::Json<QuestProgress>",
                  completed_at, created_at, updated_at
        "#,
        Uuid::new_v4(),
        user_id,
        quest_id,
        status as QuestStatus,
        sqlx::types::Json(progress),
        completed_at
    )
    .fetch_one(pool)
    .await
    .expect("Failed to create test user quest")
}

pub async fn create_test_nft(
    pool: &PgPool,
    owner_id: Uuid,
    token_type: NFTType,
    token_id: i64,
) -> NFTMetadata {
    let metadata = NFTMetadataContent {
        name: format!("Test {} NFT", format!("{:?}", token_type)),
        description: "A test NFT".to_string(),
        image: "https://example.com/image.png".to_string(),
        attributes: vec![],
        properties: HashMap::new(),
    };

    sqlx::query_as!(
        NFTMetadata,
        r#"
        INSERT INTO nft_metadata (id, token_id, token_type, owner_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, token_id, 
                  token_type as "token_type: NFTType",
                  owner_id,
                  metadata as "metadata: sqlx::types::Json<NFTMetadataContent>",
                  created_at, updated_at
        "#,
        Uuid::new_v4(),
        token_id,
        token_type as NFTType,
        owner_id,
        sqlx::types::Json(metadata)
    )
    .fetch_one(pool)
    .await
    .expect("Failed to create test NFT")
}
