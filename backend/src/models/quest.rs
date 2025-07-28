use serde::{Deserialize, Serialize};
use sqlx::types::{Json, Uuid};
use time::OffsetDateTime;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Quest {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub requirements: Json<QuestRequirements>,
    pub rewards: Json<QuestRewards>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuestRequirements {
    pub skill_level: Option<u32>,
    pub prerequisites: Vec<Uuid>, // Quest IDs that must be completed first
    pub skills_required: Vec<String>, // Skill names required
    pub min_badges: Option<u32>, // Minimum number of badges required
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuestRewards {
    pub experience_points: u32,
    pub badge_name: String,
    pub badge_description: String,
    pub skills_unlocked: Vec<String>, // Skills unlocked upon completion
    pub next_quests: Vec<Uuid>, // Quests unlocked upon completion
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserQuest {
    pub id: Uuid,
    pub user_id: Uuid,
    pub quest_id: Uuid,
    pub status: QuestStatus,
    pub progress: Json<QuestProgress>,
    pub completed_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum QuestStatus {
    NotStarted,
    InProgress,
    Completed,
    Failed,
    Locked,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuestProgress {
    pub steps_completed: Vec<String>,
    pub current_step: Option<String>,
    pub completion_percentage: f32,
    pub attempts: u32,
    pub hints_used: u32,
    pub time_spent_minutes: u32,
    pub custom_data: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuestWithProgress {
    pub quest: Quest,
    pub user_quest: Option<UserQuest>,
    pub is_unlocked: bool,
    pub unlock_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateQuestRequest {
    pub title: String,
    pub description: String,
    pub requirements: QuestRequirements,
    pub rewards: QuestRewards,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateQuestProgressRequest {
    pub steps_completed: Option<Vec<String>>,
    pub current_step: Option<String>,
    pub completion_percentage: Option<f32>,
    pub custom_data: Option<HashMap<String, serde_json::Value>>,
}

impl Default for QuestProgress {
    fn default() -> Self {
        Self {
            steps_completed: Vec::new(),
            current_step: None,
            completion_percentage: 0.0,
            attempts: 0,
            hints_used: 0,
            time_spent_minutes: 0,
            custom_data: HashMap::new(),
        }
    }
}

impl Default for QuestRequirements {
    fn default() -> Self {
        Self {
            skill_level: None,
            prerequisites: Vec::new(),
            skills_required: Vec::new(),
            min_badges: None,
        }
    }
}

impl Default for QuestRewards {
    fn default() -> Self {
        Self {
            experience_points: 0,
            badge_name: String::new(),
            badge_description: String::new(),
            skills_unlocked: Vec::new(),
            next_quests: Vec::new(),
        }
    }
}
