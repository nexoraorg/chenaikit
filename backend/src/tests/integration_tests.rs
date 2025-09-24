use super::*;
use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use tower::ServiceExt;
use serde_json::Value;

use crate::{
    models::{
        quest::QuestStatus,
        nft::NFTType,
        progress::{UserProgress, ProgressGraph},
    },
    routes,
    services::AppState,
};

async fn create_test_app() -> (Router, TestContext) {
    let ctx = TestContext::new().await;
    
    let app_state = AppState {
        config: std::sync::Arc::new(crate::config::Config {
            database_url: "test".to_string(),
            redis_url: "test".to_string(),
            jwt_secret: "test_secret".to_string(),
            port: 8080,
        }),
        db: ctx.pool.clone(),
        redis: ctx.cache.redis_client.clone(),
        cache: std::sync::Arc::new(ctx.cache.clone()),
    };

    let app = routes::create_router(app_state);
    (app, ctx)
}

#[tokio::test]
async fn test_get_user_progress_endpoint() {
    let (app, ctx) = create_test_app().await;
    
    // Create some test data
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

    create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Character, 1).await;
    create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 2).await;

    // Make request
    let request = Request::builder()
        .uri(&format!("/api/users/{}/progress", ctx.test_user.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let progress: UserProgress = serde_json::from_slice(&body).unwrap();

    // Verify response structure
    assert_eq!(progress.user_id, ctx.test_user.id);
    assert!(progress.character.is_some());
    assert_eq!(progress.overall_stats.quests_completed, 1);
    assert_eq!(progress.overall_stats.quests_in_progress, 1);
    assert_eq!(progress.overall_stats.badges_earned, 1);
    assert!(!progress.skill_trees.is_empty());
    assert_eq!(progress.quests.completed.len(), 1);
    assert_eq!(progress.quests.in_progress.len(), 1);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_get_user_progress_graph_endpoint() {
    let (app, ctx) = create_test_app().await;
    
    // Create test data
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 1).await;

    // Make request
    let request = Request::builder()
        .uri(&format!("/api/users/{}/progress/graph", ctx.test_user.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let graph: ProgressGraph = serde_json::from_slice(&body).unwrap();

    // Verify graph structure
    assert!(!graph.nodes.is_empty());
    assert!(!graph.edges.is_empty());
    assert!(graph.metadata.total_nodes > 0);
    assert!(graph.metadata.completion_percentage >= 0.0);

    // Check for quest nodes
    let quest_nodes: Vec<_> = graph.nodes.iter()
        .filter(|n| n.node_type == crate::models::progress::NodeType::Quest)
        .collect();
    assert!(!quest_nodes.is_empty());

    // Check for skill tree nodes
    let skill_tree_nodes: Vec<_> = graph.nodes.iter()
        .filter(|n| n.node_type == crate::models::progress::NodeType::SkillTree)
        .collect();
    assert!(!skill_tree_nodes.is_empty());

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_user_not_found() {
    let (app, ctx) = create_test_app().await;
    
    let non_existent_user_id = Uuid::new_v4();

    let request = Request::builder()
        .uri(&format!("/api/users/{}/progress", non_existent_user_id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_progress_with_query_parameters() {
    let (app, ctx) = create_test_app().await;
    
    // Create test data
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    // Test with include_locked=false
    let request = Request::builder()
        .uri(&format!("/api/users/{}/progress?include_locked=false", ctx.test_user.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let progress: UserProgress = serde_json::from_slice(&body).unwrap();

    // Should have no locked quests when include_locked=false
    assert_eq!(progress.quests.locked.len(), 0);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_caching_behavior() {
    let (app, ctx) = create_test_app().await;
    
    // Create test data
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    // First request (should miss cache)
    let request1 = Request::builder()
        .uri(&format!("/api/users/{}/progress", ctx.test_user.id))
        .body(Body::empty())
        .unwrap();

    let response1 = app.clone().oneshot(request1).await.unwrap();
    assert_eq!(response1.status(), StatusCode::OK);

    // Second request (should hit cache)
    let request2 = Request::builder()
        .uri(&format!("/api/users/{}/progress", ctx.test_user.id))
        .body(Body::empty())
        .unwrap();

    let response2 = app.oneshot(request2).await.unwrap();
    assert_eq!(response2.status(), StatusCode::OK);

    // Verify cache hit was recorded
    let hit_rate = ctx.cache.get_cache_hit_rate("user_progress").await.unwrap();
    assert!(hit_rate > 0.0);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_progress_with_multiple_skill_categories() {
    let (app, ctx) = create_test_app().await;
    
    // Create quests from different categories
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id, // HTML (Frontend)
        QuestStatus::Completed,
        100.0,
    ).await;

    // Make request
    let request = Request::builder()
        .uri(&format!("/api/users/{}/progress", ctx.test_user.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let progress: UserProgress = serde_json::from_slice(&body).unwrap();

    // Should have multiple skill trees
    assert!(progress.skill_trees.len() >= 2);

    // Should have frontend skill tree with progress
    let frontend_tree = progress.skill_trees.iter()
        .find(|st| st.category == crate::models::progress::SkillCategory::Frontend)
        .expect("Frontend skill tree not found");
    
    assert!(frontend_tree.completion_percentage > 0.0);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_progress_unlock_logic_integration() {
    let (app, ctx) = create_test_app().await;
    
    // Complete first quest (HTML)
    create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    // Make request
    let request = Request::builder()
        .uri(&format!("/api/users/{}/progress", ctx.test_user.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let progress: UserProgress = serde_json::from_slice(&body).unwrap();

    // CSS quest should be available (unlocked by HTML completion)
    let css_quest_available = progress.quests.available.iter()
        .any(|q| q.quest.id == ctx.test_quests[1].id);
    assert!(css_quest_available);

    // JavaScript quest should be locked (requires level 2 and 2 badges)
    let js_quest_locked = progress.quests.locked.iter()
        .any(|q| q.quest.id == ctx.test_quests[2].id);
    assert!(js_quest_locked);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_health_check_endpoint() {
    let (app, ctx) = create_test_app().await;
    
    let request = Request::builder()
        .uri("/health")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let health: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(health["status"], "ok");

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_invalid_uuid_handling() {
    let (app, ctx) = create_test_app().await;
    
    let request = Request::builder()
        .uri("/api/users/invalid-uuid/progress")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    ctx.cleanup().await;
}
