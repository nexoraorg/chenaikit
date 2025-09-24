use axum::{
    extract::{Path, Query, State},
    Json,
};
use sqlx::types::Uuid;
use time::OffsetDateTime;
use std::collections::HashMap;

use crate::{
    error::AppError,
    services::{AppState, skill_tree::SkillTreeService},
    models::{
        progress::{
            UserProgress, OverallStats, SkillTree, Skill, QuestProgress as ProgressQuests,
            Achievement, UnlockPath, ProgressQuery, ProgressGraph, ProgressNode, ProgressEdge,
            NodeType, NodeStatus, EdgeType, GraphMetadata, SkillCategory
        },
        quest::{QuestWithProgress, QuestStatus},
        nft::{CharacterNFT, BadgeNFT, BadgeRarity, CharacterSkill, CharacterAppearance},
    },
    db,
};

pub async fn get_user_progress(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Query(query): Query<ProgressQuery>,
) -> Result<Json<UserProgress>, AppError> {
    // Try to get from cache first
    if let Ok(Some(cached_progress)) = state.cache.get_cached_user_progress(user_id).await {
        let _ = state.cache.record_cache_hit("user_progress").await;
        return Ok(Json(cached_progress));
    }
    let _ = state.cache.record_cache_miss("user_progress").await;

    // Verify user exists
    let user = db::users::get_user_by_id(&state.db, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Get overall stats
    let overall_stats = db::progress::get_user_overall_stats(&state.db, user_id).await?;

    // Get character NFT
    let character_nft = db::nfts::get_user_character_nft(&state.db, user_id).await?;
    let character = character_nft.map(|nft| CharacterNFT {
        nft,
        level: overall_stats.level,
        experience_points: overall_stats.total_experience,
        skills: vec![], // TODO: Implement skill tracking
        appearance: CharacterAppearance::default(),
    });

    // Get all quests and user progress
    let all_quests = db::quests::get_all_quests(&state.db).await?;
    let user_quest_progress = db::quests::get_all_user_quest_progress(&state.db, user_id).await?;

    // Create a map for quick lookup
    let progress_map: HashMap<Uuid, _> = user_quest_progress
        .into_iter()
        .map(|uq| (uq.quest_id, uq))
        .collect();

    // Categorize quests by status
    let mut completed = Vec::new();
    let mut in_progress = Vec::new();
    let mut available = Vec::new();
    let mut locked = Vec::new();

    for quest in all_quests {
        let user_quest = progress_map.get(&quest.id);
        let is_unlocked = SkillTreeService::is_quest_unlocked(&quest, &completed, &overall_stats, &badges);

        let quest_with_progress = QuestWithProgress {
            quest: quest.clone(),
            user_quest: user_quest.cloned(),
            is_unlocked,
            unlock_reason: if is_unlocked {
                Some("Requirements met".to_string())
            } else {
                Some("Prerequisites not completed".to_string())
            },
        };

        match user_quest {
            Some(uq) => match uq.status {
                QuestStatus::Completed => completed.push(quest_with_progress),
                QuestStatus::InProgress => in_progress.push(quest_with_progress),
                QuestStatus::Failed => available.push(quest_with_progress),
                _ => {
                    if is_unlocked {
                        available.push(quest_with_progress);
                    } else {
                        locked.push(quest_with_progress);
                    }
                }
            },
            None => {
                if is_unlocked {
                    available.push(quest_with_progress);
                } else {
                    locked.push(quest_with_progress);
                }
            }
        }
    }

    let (total_quest_count, quest_completion_percentage) = 
        db::progress::get_quest_completion_stats(&state.db, user_id).await?;

    let quest_progress = ProgressQuests {
        completed,
        in_progress,
        available,
        locked: if query.include_locked.unwrap_or(true) { locked } else { Vec::new() },
        total_count: total_quest_count,
        completion_percentage: quest_completion_percentage,
    };

    // Get badges
    let badge_nfts = db::nfts::get_user_badges(&state.db, user_id).await?;
    let badges: Vec<BadgeNFT> = badge_nfts
        .into_iter()
        .map(|nft| BadgeNFT {
            quest_id: Uuid::new_v4(), // TODO: Link to actual quest
            skill_category: "General".to_string(), // TODO: Derive from quest
            rarity: BadgeRarity::Common, // TODO: Derive from quest difficulty
            earned_at: nft.created_at,
            nft,
        })
        .collect();

    // Create skill trees using the service
    let skill_trees = SkillTreeService::generate_skill_trees(&quest_progress.completed, &overall_stats);

    // Create achievements (simplified for now)
    let achievements = create_achievements(&overall_stats, &badges);

    // Create unlock paths using the service
    let unlock_paths = SkillTreeService::generate_unlock_paths(
        &all_quests,
        &quest_progress.completed,
        &quest_progress.in_progress,
        &quest_progress.available,
    );

    let progress = UserProgress {
        user_id,
        character,
        overall_stats,
        skill_trees,
        quests: quest_progress,
        badges,
        achievements,
        unlock_paths,
        generated_at: OffsetDateTime::now_utc(),
    };

    // Cache the result for future requests
    let _ = state.cache.cache_user_progress(
        user_id,
        &progress,
        crate::services::cache::DEFAULT_CACHE_TTL
    ).await;

    Ok(Json(progress))
}

pub async fn get_user_progress_graph(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<ProgressGraph>, AppError> {
    // Get basic progress data
    let progress_response = get_user_progress(State(state), Path(user_id), Query(ProgressQuery::default())).await?;
    let progress = progress_response.0;

    // Convert to graph format with better positioning
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    // Add skill tree nodes at the top level
    for (i, skill_tree) in progress.skill_trees.iter().enumerate() {
        let mut metadata = HashMap::new();
        metadata.insert("completion_percentage".to_string(),
                        serde_json::Value::Number(serde_json::Number::from_f64(skill_tree.completion_percentage as f64).unwrap()));
        metadata.insert("category".to_string(),
                        serde_json::Value::String(format!("{:?}", skill_tree.category)));

        nodes.push(ProgressNode {
            id: skill_tree.id.clone(),
            node_type: NodeType::SkillTree,
            title: skill_tree.name.clone(),
            description: skill_tree.description.clone(),
            status: if skill_tree.completion_percentage > 0.0 {
                NodeStatus::InProgress
            } else if skill_tree.unlocked_at.is_some() {
                NodeStatus::Available
            } else {
                NodeStatus::Locked
            },
            position: Some(crate::models::progress::NodePosition {
                x: i as f32 * 400.0,
                y: 0.0,
                layer: 0,
            }),
            metadata,
        });
    }

    // Add quest nodes organized by status and skill tree
    let mut quest_counter = 0;

    // Completed quests
    for quest in &progress.quests.completed {
        let mut metadata = HashMap::new();
        metadata.insert("experience_points".to_string(),
                        serde_json::Value::Number(serde_json::Number::from(quest.quest.rewards.experience_points)));
        metadata.insert("badge_name".to_string(),
                        serde_json::Value::String(quest.quest.rewards.badge_name.clone()));

        if let Some(user_quest) = &quest.user_quest {
            metadata.insert("completion_percentage".to_string(),
                            serde_json::Value::Number(serde_json::Number::from_f64(user_quest.progress.completion_percentage as f64).unwrap()));
        }

        nodes.push(ProgressNode {
            id: quest.quest.id.to_string(),
            node_type: NodeType::Quest,
            title: quest.quest.title.clone(),
            description: quest.quest.description.clone(),
            status: NodeStatus::Completed,
            position: Some(crate::models::progress::NodePosition {
                x: (quest_counter % 6) as f32 * 200.0,
                y: 200.0 + (quest_counter / 6) as f32 * 120.0,
                layer: 1,
            }),
            metadata,
        });
        quest_counter += 1;
    }

    // In-progress quests
    for quest in &progress.quests.in_progress {
        let mut metadata = HashMap::new();
        metadata.insert("experience_points".to_string(),
                        serde_json::Value::Number(serde_json::Number::from(quest.quest.rewards.experience_points)));

        if let Some(user_quest) = &quest.user_quest {
            metadata.insert("completion_percentage".to_string(),
                            serde_json::Value::Number(serde_json::Number::from_f64(user_quest.progress.completion_percentage as f64).unwrap()));
            metadata.insert("attempts".to_string(),
                            serde_json::Value::Number(serde_json::Number::from(user_quest.progress.attempts)));
        }

        nodes.push(ProgressNode {
            id: quest.quest.id.to_string(),
            node_type: NodeType::Quest,
            title: quest.quest.title.clone(),
            description: quest.quest.description.clone(),
            status: NodeStatus::InProgress,
            position: Some(crate::models::progress::NodePosition {
                x: (quest_counter % 6) as f32 * 200.0,
                y: 200.0 + (quest_counter / 6) as f32 * 120.0,
                layer: 1,
            }),
            metadata,
        });
        quest_counter += 1;
    }

    // Available quests
    for quest in &progress.quests.available {
        let mut metadata = HashMap::new();
        metadata.insert("experience_points".to_string(),
                        serde_json::Value::Number(serde_json::Number::from(quest.quest.rewards.experience_points)));
        metadata.insert("prerequisites_count".to_string(),
                        serde_json::Value::Number(serde_json::Number::from(quest.quest.requirements.prerequisites.len())));

        nodes.push(ProgressNode {
            id: quest.quest.id.to_string(),
            node_type: NodeType::Quest,
            title: quest.quest.title.clone(),
            description: quest.quest.description.clone(),
            status: NodeStatus::Available,
            position: Some(crate::models::progress::NodePosition {
                x: (quest_counter % 6) as f32 * 200.0,
                y: 200.0 + (quest_counter / 6) as f32 * 120.0,
                layer: 1,
            }),
            metadata,
        });
        quest_counter += 1;
    }

    // Add badge nodes
    for (i, badge) in progress.badges.iter().enumerate() {
        let mut metadata = HashMap::new();
        metadata.insert("rarity".to_string(),
                        serde_json::Value::String(format!("{:?}", badge.rarity)));
        metadata.insert("skill_category".to_string(),
                        serde_json::Value::String(badge.skill_category.clone()));

        nodes.push(ProgressNode {
            id: format!("badge_{}", badge.nft.token_id),
            node_type: NodeType::Badge,
            title: badge.nft.metadata.name.clone(),
            description: badge.nft.metadata.description.clone(),
            status: NodeStatus::Completed,
            position: Some(crate::models::progress::NodePosition {
                x: (i % 8) as f32 * 150.0,
                y: 500.0 + (i / 8) as f32 * 100.0,
                layer: 2,
            }),
            metadata,
        });
    }

    // Add edges for quest dependencies
    for unlock_path in &progress.unlock_paths {
        if let Some(from_id) = unlock_path.from_quest_id {
            edges.push(ProgressEdge {
                from: from_id.to_string(),
                to: unlock_path.to_quest_id.to_string(),
                edge_type: EdgeType::Unlocks,
                weight: Some(if unlock_path.requirements_met { 1.0 } else { 0.5 }),
                is_active: unlock_path.requirements_met,
            });
        }
    }

    // Add edges from quests to badges
    for badge in &progress.badges {
        edges.push(ProgressEdge {
            from: badge.quest_id.to_string(),
            to: format!("badge_{}", badge.nft.token_id),
            edge_type: EdgeType::Unlocks,
            weight: Some(1.0),
            is_active: true,
        });
    }

    // Generate suggested next actions
    let mut suggested_actions = Vec::new();
    if !progress.quests.available.is_empty() {
        suggested_actions.push(format!("Complete {} available quest(s)", progress.quests.available.len()));
    }
    if !progress.quests.in_progress.is_empty() {
        suggested_actions.push(format!("Continue {} in-progress quest(s)", progress.quests.in_progress.len()));
    }
    if progress.skill_trees.iter().any(|st| st.unlocked_at.is_none()) {
        suggested_actions.push("Unlock new skill trees by completing more quests".to_string());
    }

    let graph = ProgressGraph {
        nodes,
        edges,
        metadata: GraphMetadata {
            total_nodes: progress.quests.total_count + progress.skill_trees.len() as u32 + progress.badges.len() as u32,
            total_edges: progress.unlock_paths.len() as u32 + progress.badges.len() as u32,
            completion_percentage: progress.overall_stats.completion_rate,
            suggested_next_actions: suggested_actions,
        },
    };

    Ok(Json(graph))
}

// Helper functions

fn create_achievements(_stats: &OverallStats, badges: &[BadgeNFT]) -> Vec<Achievement> {
    let mut achievements = Vec::new();

    if badges.len() >= 1 {
        achievements.push(Achievement {
            id: "first_badge".to_string(),
            name: "First Steps".to_string(),
            description: "Earned your first badge".to_string(),
            icon: "🏅".to_string(),
            rarity: BadgeRarity::Common,
            unlocked_at: badges.first().unwrap().earned_at,
            progress: None,
        });
    }

    achievements
}


