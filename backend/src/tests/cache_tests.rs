use super::*;
use crate::{
    models::progress::{UserProgress, OverallStats, SkillTree, SkillCategory},
    services::cache::{CacheService, DEFAULT_CACHE_TTL},
};
use time::OffsetDateTime;

#[tokio::test]
async fn test_cache_user_progress() {
    let ctx = TestContext::new().await;
    
    let progress = create_test_user_progress(ctx.test_user.id);
    
    // Cache the progress
    let result = ctx.cache.cache_user_progress(ctx.test_user.id, &progress, DEFAULT_CACHE_TTL).await;
    assert!(result.is_ok());

    // Retrieve from cache
    let cached_progress = ctx.cache.get_cached_user_progress(ctx.test_user.id).await;
    assert!(cached_progress.is_ok());
    assert!(cached_progress.unwrap().is_some());

    let retrieved = cached_progress.unwrap().unwrap();
    assert_eq!(retrieved.user_id, progress.user_id);
    assert_eq!(retrieved.overall_stats.level, progress.overall_stats.level);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_cache_invalidation() {
    let ctx = TestContext::new().await;
    
    let progress = create_test_user_progress(ctx.test_user.id);
    
    // Cache the progress
    ctx.cache.cache_user_progress(ctx.test_user.id, &progress, DEFAULT_CACHE_TTL).await.unwrap();

    // Verify it's cached
    let cached = ctx.cache.get_cached_user_progress(ctx.test_user.id).await.unwrap();
    assert!(cached.is_some());

    // Invalidate cache
    let result = ctx.cache.invalidate_user_progress(ctx.test_user.id).await;
    assert!(result.is_ok());

    // Verify it's no longer cached
    let cached_after = ctx.cache.get_cached_user_progress(ctx.test_user.id).await.unwrap();
    assert!(cached_after.is_none());

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_cache_overall_stats() {
    let ctx = TestContext::new().await;
    
    let stats = OverallStats {
        total_experience: 500,
        level: 5,
        quests_completed: 5,
        quests_in_progress: 2,
        badges_earned: 3,
        skills_unlocked: 8,
        total_time_spent_hours: 10.5,
        completion_rate: 75.0,
        streak_days: 7,
        last_activity: Some(OffsetDateTime::now_utc()),
    };

    // Cache the stats
    let result = ctx.cache.cache_overall_stats(ctx.test_user.id, &stats, DEFAULT_CACHE_TTL).await;
    assert!(result.is_ok());

    // Retrieve from cache
    let cached_stats = ctx.cache.get_cached_overall_stats(ctx.test_user.id).await;
    assert!(cached_stats.is_ok());
    assert!(cached_stats.unwrap().is_some());

    let retrieved = cached_stats.unwrap().unwrap();
    assert_eq!(retrieved.level, stats.level);
    assert_eq!(retrieved.total_experience, stats.total_experience);
    assert_eq!(retrieved.quests_completed, stats.quests_completed);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_cache_skill_trees() {
    let ctx = TestContext::new().await;
    
    let skill_trees = vec![
        SkillTree {
            id: "frontend".to_string(),
            name: "Frontend Development".to_string(),
            description: "Frontend skills".to_string(),
            category: SkillCategory::Frontend,
            skills: vec![],
            completion_percentage: 45.0,
            unlocked_at: Some(OffsetDateTime::now_utc()),
        },
        SkillTree {
            id: "backend".to_string(),
            name: "Backend Development".to_string(),
            description: "Backend skills".to_string(),
            category: SkillCategory::Backend,
            skills: vec![],
            completion_percentage: 20.0,
            unlocked_at: None,
        },
    ];

    // Cache the skill trees
    let result = ctx.cache.cache_skill_trees(ctx.test_user.id, &skill_trees, DEFAULT_CACHE_TTL).await;
    assert!(result.is_ok());

    // Retrieve from cache
    let cached_trees = ctx.cache.get_cached_skill_trees(ctx.test_user.id).await;
    assert!(cached_trees.is_ok());
    assert!(cached_trees.unwrap().is_some());

    let retrieved = cached_trees.unwrap().unwrap();
    assert_eq!(retrieved.len(), 2);
    assert_eq!(retrieved[0].id, "frontend");
    assert_eq!(retrieved[1].id, "backend");

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_cache_quest_stats() {
    let ctx = TestContext::new().await;
    
    let total_quests = 10;
    let completion_percentage = 60.0;

    // Cache the quest stats
    let result = ctx.cache.cache_quest_stats(
        ctx.test_user.id,
        total_quests,
        completion_percentage,
        DEFAULT_CACHE_TTL,
    ).await;
    assert!(result.is_ok());

    // Retrieve from cache
    let cached_stats = ctx.cache.get_cached_quest_stats(ctx.test_user.id).await;
    assert!(cached_stats.is_ok());
    assert!(cached_stats.unwrap().is_some());

    let (retrieved_total, retrieved_percentage) = cached_stats.unwrap().unwrap();
    assert_eq!(retrieved_total, total_quests);
    assert_eq!(retrieved_percentage, completion_percentage);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_cache_metrics() {
    let ctx = TestContext::new().await;
    
    // Record cache hit
    let result = ctx.cache.record_cache_hit("user_progress").await;
    assert!(result.is_ok());

    // Record cache miss
    let result = ctx.cache.record_cache_miss("user_progress").await;
    assert!(result.is_ok());

    // Record another hit
    let result = ctx.cache.record_cache_hit("user_progress").await;
    assert!(result.is_ok());

    // Get hit rate (should be 2/3 = 0.666...)
    let hit_rate = ctx.cache.get_cache_hit_rate("user_progress").await;
    assert!(hit_rate.is_ok());
    let rate = hit_rate.unwrap();
    assert!((rate - 0.6666666666666666).abs() < 0.001);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_cache_warmup() {
    let ctx = TestContext::new().await;
    
    let progress = create_test_user_progress(ctx.test_user.id);

    // Warm up cache
    let result = ctx.cache.warmup_user_cache(ctx.test_user.id, &progress).await;
    assert!(result.is_ok());

    // Verify all components are cached
    let cached_progress = ctx.cache.get_cached_user_progress(ctx.test_user.id).await.unwrap();
    assert!(cached_progress.is_some());

    let cached_stats = ctx.cache.get_cached_overall_stats(ctx.test_user.id).await.unwrap();
    assert!(cached_stats.is_some());

    let cached_trees = ctx.cache.get_cached_skill_trees(ctx.test_user.id).await.unwrap();
    assert!(cached_trees.is_some());

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_cache_invalidate_all() {
    let ctx = TestContext::new().await;
    
    let progress = create_test_user_progress(ctx.test_user.id);

    // Cache multiple items
    ctx.cache.cache_user_progress(ctx.test_user.id, &progress, DEFAULT_CACHE_TTL).await.unwrap();
    ctx.cache.cache_overall_stats(ctx.test_user.id, &progress.overall_stats, DEFAULT_CACHE_TTL).await.unwrap();
    ctx.cache.cache_skill_trees(ctx.test_user.id, &progress.skill_trees, DEFAULT_CACHE_TTL).await.unwrap();

    // Verify all are cached
    assert!(ctx.cache.get_cached_user_progress(ctx.test_user.id).await.unwrap().is_some());
    assert!(ctx.cache.get_cached_overall_stats(ctx.test_user.id).await.unwrap().is_some());
    assert!(ctx.cache.get_cached_skill_trees(ctx.test_user.id).await.unwrap().is_some());

    // Invalidate all user caches
    let result = ctx.cache.invalidate_user_caches(ctx.test_user.id).await;
    assert!(result.is_ok());

    // Verify all are cleared
    assert!(ctx.cache.get_cached_user_progress(ctx.test_user.id).await.unwrap().is_none());
    assert!(ctx.cache.get_cached_overall_stats(ctx.test_user.id).await.unwrap().is_none());
    assert!(ctx.cache.get_cached_skill_trees(ctx.test_user.id).await.unwrap().is_none());

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_cache_expiration() {
    let ctx = TestContext::new().await;
    
    let progress = create_test_user_progress(ctx.test_user.id);
    
    // Cache with very short TTL (1 second)
    let result = ctx.cache.cache_user_progress(ctx.test_user.id, &progress, 1).await;
    assert!(result.is_ok());

    // Should be available immediately
    let cached = ctx.cache.get_cached_user_progress(ctx.test_user.id).await.unwrap();
    assert!(cached.is_some());

    // Wait for expiration
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Should be expired now
    let cached_after = ctx.cache.get_cached_user_progress(ctx.test_user.id).await.unwrap();
    assert!(cached_after.is_none());

    ctx.cleanup().await;
}

fn create_test_user_progress(user_id: uuid::Uuid) -> UserProgress {
    UserProgress {
        user_id,
        character: None,
        overall_stats: OverallStats {
            total_experience: 300,
            level: 3,
            quests_completed: 3,
            quests_in_progress: 1,
            badges_earned: 2,
            skills_unlocked: 5,
            total_time_spent_hours: 5.5,
            completion_rate: 60.0,
            streak_days: 5,
            last_activity: Some(OffsetDateTime::now_utc()),
        },
        skill_trees: vec![
            SkillTree {
                id: "frontend".to_string(),
                name: "Frontend Development".to_string(),
                description: "Frontend skills".to_string(),
                category: SkillCategory::Frontend,
                skills: vec![],
                completion_percentage: 40.0,
                unlocked_at: Some(OffsetDateTime::now_utc()),
            },
        ],
        quests: crate::models::progress::QuestProgress {
            completed: vec![],
            in_progress: vec![],
            available: vec![],
            locked: vec![],
            total_count: 5,
            completion_percentage: 60.0,
        },
        badges: vec![],
        achievements: vec![],
        unlock_paths: vec![],
        generated_at: OffsetDateTime::now_utc(),
    }
}
