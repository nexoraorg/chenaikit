use super::*;
use crate::{
    models::{
        quest::{QuestWithProgress, QuestStatus},
        nft::{NFTType, BadgeNFT, BadgeRarity},
        progress::{OverallStats, SkillCategory},
    },
    services::skill_tree::SkillTreeService,
};

#[tokio::test]
async fn test_quest_unlock_logic() {
    let ctx = TestContext::new().await;
    
    // Create some completed quests
    let completed_quest = create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    let completed_quests = vec![QuestWithProgress {
        quest: ctx.test_quests[0].clone(),
        user_quest: Some(completed_quest),
        is_unlocked: true,
        unlock_reason: Some("Completed".to_string()),
    }];

    let overall_stats = OverallStats {
        total_experience: 100,
        level: 1,
        quests_completed: 1,
        quests_in_progress: 0,
        badges_earned: 0,
        skills_unlocked: 1,
        total_time_spent_hours: 1.0,
        completion_rate: 33.33,
        streak_days: 1,
        last_activity: Some(time::OffsetDateTime::now_utc()),
    };

    let badges = vec![];

    // Test quest with no prerequisites (should be unlocked)
    let quest_no_prereqs = &ctx.test_quests[0];
    let is_unlocked = SkillTreeService::is_quest_unlocked(
        quest_no_prereqs,
        &completed_quests,
        &overall_stats,
        &badges,
    );
    assert!(is_unlocked);

    // Test quest with prerequisites (should be unlocked since prerequisite is completed)
    let quest_with_prereqs = &ctx.test_quests[1]; // CSS quest requires HTML quest
    let is_unlocked = SkillTreeService::is_quest_unlocked(
        quest_with_prereqs,
        &completed_quests,
        &overall_stats,
        &badges,
    );
    assert!(is_unlocked);

    // Test quest with level requirement (should be locked)
    let quest_level_req = &ctx.test_quests[2]; // JavaScript quest requires level 2
    let is_unlocked = SkillTreeService::is_quest_unlocked(
        quest_level_req,
        &completed_quests,
        &overall_stats,
        &badges,
    );
    assert!(!is_unlocked); // Level 1 < required level 2

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_quest_unlock_with_badge_requirements() {
    let ctx = TestContext::new().await;
    
    // Create badges
    let badge1 = create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 1).await;
    let badge2 = create_test_nft(&ctx.pool, ctx.test_user.id, NFTType::Badge, 2).await;

    let badges = vec![
        BadgeNFT {
            nft: badge1,
            quest_id: ctx.test_quests[0].id,
            skill_category: "Frontend".to_string(),
            rarity: BadgeRarity::Common,
            earned_at: time::OffsetDateTime::now_utc(),
        },
        BadgeNFT {
            nft: badge2,
            quest_id: ctx.test_quests[1].id,
            skill_category: "Frontend".to_string(),
            rarity: BadgeRarity::Common,
            earned_at: time::OffsetDateTime::now_utc(),
        },
    ];

    let completed_quests = vec![];
    let overall_stats = OverallStats {
        total_experience: 200,
        level: 2,
        quests_completed: 2,
        quests_in_progress: 0,
        badges_earned: 2,
        skills_unlocked: 2,
        total_time_spent_hours: 2.0,
        completion_rate: 66.67,
        streak_days: 2,
        last_activity: Some(time::OffsetDateTime::now_utc()),
    };

    // Test quest with badge requirement (should be unlocked)
    let quest_badge_req = &ctx.test_quests[2]; // JavaScript quest requires 2 badges
    let is_unlocked = SkillTreeService::is_quest_unlocked(
        quest_badge_req,
        &completed_quests,
        &overall_stats,
        &badges,
    );
    assert!(is_unlocked); // Has 2 badges, meets requirement

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_skill_tree_generation() {
    let ctx = TestContext::new().await;
    
    // Create completed frontend quests
    let completed_quest = create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id, // HTML quest
        QuestStatus::Completed,
        100.0,
    ).await;

    let completed_quests = vec![QuestWithProgress {
        quest: ctx.test_quests[0].clone(),
        user_quest: Some(completed_quest),
        is_unlocked: true,
        unlock_reason: Some("Completed".to_string()),
    }];

    let overall_stats = OverallStats {
        total_experience: 100,
        level: 1,
        quests_completed: 1,
        quests_in_progress: 0,
        badges_earned: 1,
        skills_unlocked: 1,
        total_time_spent_hours: 1.0,
        completion_rate: 33.33,
        streak_days: 1,
        last_activity: Some(time::OffsetDateTime::now_utc()),
    };

    let skill_trees = SkillTreeService::generate_skill_trees(&completed_quests, &overall_stats);

    // Should have multiple skill trees
    assert!(skill_trees.len() >= 4);

    // Find frontend skill tree
    let frontend_tree = skill_trees.iter()
        .find(|st| st.category == SkillCategory::Frontend)
        .expect("Frontend skill tree not found");

    assert_eq!(frontend_tree.name, "Frontend Development");
    assert!(frontend_tree.completion_percentage > 0.0); // Should have some progress
    assert!(frontend_tree.unlocked_at.is_some()); // Should be unlocked

    // Check skills within the tree
    assert!(!frontend_tree.skills.is_empty());
    let html_skill = frontend_tree.skills.iter()
        .find(|s| s.id == "html")
        .expect("HTML skill not found");
    
    assert!(html_skill.is_unlocked);
    assert!(html_skill.level > 0);

    // Find backend skill tree (should be unlocked at level 2+)
    let backend_tree = skill_trees.iter()
        .find(|st| st.category == SkillCategory::Backend)
        .expect("Backend skill tree not found");

    assert_eq!(backend_tree.name, "Backend Development");
    // Should be locked at level 1
    assert!(backend_tree.unlocked_at.is_none());

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_unlock_path_generation() {
    let ctx = TestContext::new().await;
    
    // Create a completed quest
    let completed_quest = create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    let completed_quests = vec![QuestWithProgress {
        quest: ctx.test_quests[0].clone(),
        user_quest: Some(completed_quest),
        is_unlocked: true,
        unlock_reason: Some("Completed".to_string()),
    }];

    let in_progress_quests = vec![];
    let available_quests = vec![];

    let unlock_paths = SkillTreeService::generate_unlock_paths(
        &ctx.test_quests,
        &completed_quests,
        &in_progress_quests,
        &available_quests,
    );

    // Should have unlock paths from completed quest to next quests
    assert!(!unlock_paths.is_empty());

    // Find path from HTML quest to CSS quest
    let html_to_css_path = unlock_paths.iter()
        .find(|path| {
            path.from_quest_id == Some(ctx.test_quests[0].id) &&
            path.to_quest_id == ctx.test_quests[1].id
        })
        .expect("HTML to CSS unlock path not found");

    assert!(html_to_css_path.requirements_met);
    assert_eq!(html_to_css_path.unlock_type, crate::models::progress::UnlockType::QuestCompletion);

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_skill_progression() {
    let ctx = TestContext::new().await;
    
    // Create multiple completed frontend quests
    let quest1 = create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[0].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    let quest2 = create_test_user_quest(
        &ctx.pool,
        ctx.test_user.id,
        ctx.test_quests[1].id,
        QuestStatus::Completed,
        100.0,
    ).await;

    let completed_quests = vec![
        QuestWithProgress {
            quest: ctx.test_quests[0].clone(),
            user_quest: Some(quest1),
            is_unlocked: true,
            unlock_reason: Some("Completed".to_string()),
        },
        QuestWithProgress {
            quest: ctx.test_quests[1].clone(),
            user_quest: Some(quest2),
            is_unlocked: true,
            unlock_reason: Some("Completed".to_string()),
        },
    ];

    let overall_stats = OverallStats {
        total_experience: 250,
        level: 2,
        quests_completed: 2,
        quests_in_progress: 0,
        badges_earned: 2,
        skills_unlocked: 2,
        total_time_spent_hours: 2.0,
        completion_rate: 66.67,
        streak_days: 2,
        last_activity: Some(time::OffsetDateTime::now_utc()),
    };

    let skill_trees = SkillTreeService::generate_skill_trees(&completed_quests, &overall_stats);

    let frontend_tree = skill_trees.iter()
        .find(|st| st.category == SkillCategory::Frontend)
        .expect("Frontend skill tree not found");

    // Should have higher completion percentage with more quests
    assert!(frontend_tree.completion_percentage > 10.0);

    // CSS skill should be unlocked now
    let css_skill = frontend_tree.skills.iter()
        .find(|s| s.id == "css")
        .expect("CSS skill not found");
    
    assert!(css_skill.is_unlocked);
    assert!(css_skill.level > 0);

    // JavaScript skill should still be locked (requires more quests)
    let js_skill = frontend_tree.skills.iter()
        .find(|s| s.id == "react");
    
    if let Some(js_skill) = js_skill {
        assert!(!js_skill.is_unlocked); // Should be locked until more frontend quests completed
    }

    ctx.cleanup().await;
}

#[tokio::test]
async fn test_skill_prerequisites() {
    let ctx = TestContext::new().await;
    
    // Test that skills have proper prerequisites
    let completed_quests = vec![];
    let overall_stats = OverallStats {
        total_experience: 0,
        level: 1,
        quests_completed: 0,
        quests_in_progress: 0,
        badges_earned: 0,
        skills_unlocked: 0,
        total_time_spent_hours: 0.0,
        completion_rate: 0.0,
        streak_days: 0,
        last_activity: None,
    };

    let skill_trees = SkillTreeService::generate_skill_trees(&completed_quests, &overall_stats);

    let frontend_tree = skill_trees.iter()
        .find(|st| st.category == SkillCategory::Frontend)
        .expect("Frontend skill tree not found");

    // HTML should have no prerequisites
    let html_skill = frontend_tree.skills.iter()
        .find(|s| s.id == "html")
        .expect("HTML skill not found");
    assert!(html_skill.prerequisites.is_empty());

    // CSS should require HTML
    let css_skill = frontend_tree.skills.iter()
        .find(|s| s.id == "css")
        .expect("CSS skill not found");
    assert!(css_skill.prerequisites.contains(&"html".to_string()));

    // JavaScript should require HTML and CSS
    let js_skill = frontend_tree.skills.iter()
        .find(|s| s.id == "javascript")
        .expect("JavaScript skill not found");
    assert!(js_skill.prerequisites.contains(&"html".to_string()));
    assert!(js_skill.prerequisites.contains(&"css".to_string()));

    ctx.cleanup().await;
}
