use super::*;
use crate::{
    db,
    models::{
        quest::QuestStatus,
        nft::NFTType,
        progress::OverallStats,
    },
};

#[tokio::test]
async fn test_get_user_overall_stats() {
    let ctx = TestContext::new().await;
    
    // Create some completed quests
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[1].id,
        QuestStatus::InProgress,
        50.0,
    ).await;

    // Create some badges
    create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 1).await;
    create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 2).await;

    // Get overall stats
    let stats = db::progress::get_user_overall_stats(&ctx.pool, ctx.test_user.id)
        .await
        .expect("Failed to get overall stats");

    assert_eq!(stats.quests_completed, 1);
    assert_eq!(stats.quests_in_progress, 1);
    assert_eq!(stats.badges_earned, 2);
    assert_eq!(stats.total_experience, 100); // 1 completed quest * 100 XP
    assert_eq!(stats.level, 1); // Level 1 for 100 XP
    assert!(stats.completion_rate > 0.0);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_quest_completion_stats() {
    let ctx = TestContext::new().await;
    
    // Complete one quest out of three
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    let (total, percentage) = db::progress::get_quest_completion_stats(&ctx.pool, ctx.test_user.id)
        .await
        .expect("Failed to get quest completion stats");

    assert_eq!(total, 3); // Total quests created in test setup
    assert!((percentage - 33.333333).abs() < 0.001); // 1/3 completed

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_user_quest_progress_tracking() {
    let ctx = TestContext::new().await;
    
    // Start a quest
    let user_quest = db::quests::start_quest(&ctx.pool, ctx.test_user.id, ctx.test_quests[0].id)
        .await
        .expect("Failed to start quest");

    assert_eq!(user_quest.status, QuestStatus::InProgress);
    assert_eq!(user_quest.progress.completion_percentage, 0.0);

    // Update progress
    let mut updated_progress = user_quest.progress.0.clone();
    updated_progress.completion_percentage = 75.0;
    updated_progress.steps_completed.push("step1".to_string());
    updated_progress.current_step = Some("step2".to_string());

    let updated_quest = db::quests::update_quest_progress(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        updated_progress,
    )
    .await
    .expect("Failed to update quest progress");

    assert_eq!(updated_quest.progress.completion_percentage, 75.0);
    assert_eq!(updated_quest.progress.steps_completed.len(), 1);

    // Complete the quest
    let completed_quest = db::quests::complete_quest(&ctx.pool, ctx.test_user.id, ctx.test_quests[0].id)
        .await
        .expect("Failed to complete quest");

    assert_eq!(completed_quest.status, QuestStatus::Completed);
    assert!(completed_quest.completed_at.is_some());

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_get_all_user_quest_progress() {
    let ctx = TestContext::new().await;
    
    // Create progress for multiple quests
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[1].id,
        QuestStatus::InProgress,
        60.0,
    ).await;

    let all_progress = db::quests::get_all_user_quest_progress(&ctx.pool, ctx.test_user.id)
        .await
        .expect("Failed to get all user quest progress");

    assert_eq!(all_progress.len(), 2);
    
    let completed_quest = all_progress.iter()
        .find(|uq| uq.quest_id == ctx.test_quests[0].id)
        .expect("Completed quest not found");
    assert_eq!(completed_quest.status, QuestStatus::Completed);

    let in_progress_quest = all_progress.iter()
        .find(|uq| uq.quest_id == ctx.test_quests[1].id)
        .expect("In-progress quest not found");
    assert_eq!(in_progress_quest.status, QuestStatus::InProgress);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_nft_operations() {
    let ctx = TestContext::new().await;
    
    // Create character NFT
    let character_nft = create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Character, 1).await;
    
    // Create badge NFTs
    let badge1 = create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 2).await;
    let badge2 = create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 3).await;

    // Test getting user's character NFT
    let user_character = db::nfts::get_user_character_nft(&ctx.pool, ctx.test_user.id)
        .await
        .expect("Failed to get user character NFT");

    assert!(user_character.is_some());
    assert_eq!(user_character.unwrap().token_type, NFTType::Character);

    // Test getting user's badges
    let user_badges = db::nfts::get_user_badges(&ctx.pool, ctx.test_user.id)
        .await
        .expect("Failed to get user badges");

    assert_eq!(user_badges.len(), 2);
    assert!(user_badges.iter().all(|nft| nft.token_type == NFTType::Badge));

    // Test getting all user NFTs
    let all_nfts = db::nfts::get_user_nfts(&ctx.pool, ctx.test_user.id)
        .await
        .expect("Failed to get all user NFTs");

    assert_eq!(all_nfts.len(), 3);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_quest_prerequisite_checking() {
    let ctx = TestContext::new().await;
    
    // Try to get quest that requires prerequisites
    let quest_with_prereqs = &ctx.test_quests[2]; // JavaScript quest requires HTML and CSS
    
    // Should not be able to start without prerequisites
    let user_quest_result = db::quests::get_user_quest_progress(
        &ctx.pool,
        ctx.test_user.id,
        quest_with_prereqs.id,
    ).await;

    assert!(user_quest_result.is_ok());
    assert!(user_quest_result.unwrap().is_none()); // No progress yet

    // Complete prerequisites first
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id, // HTML quest
        QuestStatus::Completed,
        100.0,
    ).await;

    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[1].id, // CSS quest
        QuestStatus::Completed,
        100.0,
    ).await;

    // Create enough badges to meet requirements
    create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 1).await;
    create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 2).await;

    // Now should be able to start the quest (this would be checked in the handler)
    let user_quest = db::quests::start_quest(&ctx.pool, ctx.test_user.id, quest_with_prereqs.id)
        .await
        .expect("Failed to start quest with met prerequisites");

    assert_eq!(user_quest.status, QuestStatus::InProgress);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_database_constraints() {
    let ctx = TestContext::new().await;
    
    // Test unique constraint on user_quests (user_id, quest_id)
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::InProgress,
        50.0,
    ).await;

    // Trying to create another user_quest for the same user and quest should fail
    let duplicate_result = sqlx::query!(
        r#"
        INSERT INTO user_quests (id, user_id, quest_id, status, progress)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        Uuid::new_v4(),
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::InProgress as QuestStatus,
        sqlx::types::Json(QuestProgress::default())
    )
    .execute(&ctx.pool)
    .await;

    assert!(duplicate_result.is_err()); // Should fail due to unique constraint

    ctx.cleanup().await;
}
