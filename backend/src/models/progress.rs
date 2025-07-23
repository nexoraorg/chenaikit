use serde::{Deserialize, Serialize};
use sqlx::types::Uuid;
use time::OffsetDateTime;
use std::collections::HashMap;

use super::{
    quest::{QuestWithProgress, QuestStatus},
    nft::{CharacterNFT, BadgeNFT, BadgeRarity},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserProgress {
    pub user_id: Uuid,
    pub character: Option<CharacterNFT>,
    pub overall_stats: OverallStats,
    pub skill_trees: Vec<SkillTree>,
    pub quests: QuestProgress,
    pub badges: Vec<BadgeNFT>,
    pub achievements: Vec<Achievement>,
    pub unlock_paths: Vec<UnlockPath>,
    pub generated_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OverallStats {
    pub total_experience: u32,
    pub level: u32,
    pub quests_completed: u32,
    pub quests_in_progress: u32,
    pub badges_earned: u32,
    pub skills_unlocked: u32,
    pub total_time_spent_hours: f32,
    pub completion_rate: f32,
    pub streak_days: u32,
    pub last_activity: Option<OffsetDateTime>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillTree {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: SkillCategory,
    pub skills: Vec<Skill>,
    pub completion_percentage: f32,
    pub unlocked_at: Option<OffsetDateTime>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum SkillCategory {
    Frontend,
    Backend,
    Blockchain,
    DataStructures,
    Algorithms,
    DevOps,
    Security,
    Testing,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub level: u32,
    pub max_level: u32,
    pub experience: u32,
    pub experience_to_next_level: u32,
    pub is_unlocked: bool,
    pub unlocked_at: Option<OffsetDateTime>,
    pub prerequisites: Vec<String>,
    pub related_quests: Vec<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuestProgress {
    pub completed: Vec<QuestWithProgress>,
    pub in_progress: Vec<QuestWithProgress>,
    pub available: Vec<QuestWithProgress>,
    pub locked: Vec<QuestWithProgress>,
    pub total_count: u32,
    pub completion_percentage: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub rarity: BadgeRarity,
    pub unlocked_at: OffsetDateTime,
    pub progress: Option<AchievementProgress>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AchievementProgress {
    pub current: u32,
    pub target: u32,
    pub percentage: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnlockPath {
    pub from_quest_id: Option<Uuid>,
    pub to_quest_id: Uuid,
    pub unlock_type: UnlockType,
    pub requirements_met: bool,
    pub missing_requirements: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum UnlockType {
    QuestCompletion,
    SkillLevel,
    BadgeCount,
    ExperiencePoints,
    TimeSpent,
}

// Graph-based response format for visualization
#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressGraph {
    pub nodes: Vec<ProgressNode>,
    pub edges: Vec<ProgressEdge>,
    pub metadata: GraphMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressNode {
    pub id: String,
    pub node_type: NodeType,
    pub title: String,
    pub description: String,
    pub status: NodeStatus,
    pub position: Option<NodePosition>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    Quest,
    Skill,
    Badge,
    Achievement,
    SkillTree,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    Locked,
    Available,
    InProgress,
    Completed,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodePosition {
    pub x: f32,
    pub y: f32,
    pub layer: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressEdge {
    pub from: String,
    pub to: String,
    pub edge_type: EdgeType,
    pub weight: Option<f32>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    Prerequisite,
    Unlocks,
    Requires,
    Enhances,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphMetadata {
    pub total_nodes: u32,
    pub total_edges: u32,
    pub completion_percentage: f32,
    pub suggested_next_actions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressQuery {
    pub include_locked: Option<bool>,
    pub skill_categories: Option<Vec<SkillCategory>>,
    pub quest_statuses: Option<Vec<QuestStatus>>,
    pub include_graph: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl Default for ProgressQuery {
    fn default() -> Self {
        Self {
            include_locked: Some(true),
            skill_categories: None,
            quest_statuses: None,
            include_graph: Some(false),
            limit: None,
            offset: None,
        }
    }
}
