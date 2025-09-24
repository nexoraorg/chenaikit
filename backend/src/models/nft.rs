use serde::{Deserialize, Serialize};
use sqlx::types::{Json, Uuid};
use time::OffsetDateTime;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NFTMetadata {
    pub id: Uuid,
    pub token_id: i64,
    pub token_type: NFTType,
    pub owner_id: Uuid,
    pub metadata: Json<NFTMetadataContent>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum NFTType {
    Character,
    Badge,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NFTMetadataContent {
    pub name: String,
    pub description: String,
    pub image: String,
    pub attributes: Vec<NFTAttribute>,
    pub properties: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NFTAttribute {
    pub trait_type: String,
    pub value: serde_json::Value,
    pub display_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CharacterNFT {
    pub nft: NFTMetadata,
    pub level: u32,
    pub experience_points: u32,
    pub skills: Vec<CharacterSkill>,
    pub appearance: CharacterAppearance,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CharacterSkill {
    pub name: String,
    pub level: u32,
    pub experience: u32,
    pub unlocked_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CharacterAppearance {
    pub background: String,
    pub body: String,
    pub clothing: Vec<String>,
    pub accessories: Vec<String>,
    pub special_effects: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BadgeNFT {
    pub nft: NFTMetadata,
    pub quest_id: Uuid,
    pub skill_category: String,
    pub rarity: BadgeRarity,
    pub earned_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BadgeRarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateNFTRequest {
    pub token_type: NFTType,
    pub metadata: NFTMetadataContent,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateNFTMetadataRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub attributes: Option<Vec<NFTAttribute>>,
    pub properties: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NFTTransferRequest {
    pub token_id: i64,
    pub from_user_id: Uuid,
    pub to_user_id: Uuid,
}

impl Default for NFTMetadataContent {
    fn default() -> Self {
        Self {
            name: String::new(),
            description: String::new(),
            image: String::new(),
            attributes: Vec::new(),
            properties: HashMap::new(),
        }
    }
}

impl Default for CharacterAppearance {
    fn default() -> Self {
        Self {
            background: "default".to_string(),
            body: "default".to_string(),
            clothing: Vec::new(),
            accessories: Vec::new(),
            special_effects: Vec::new(),
        }
    }
}

impl BadgeRarity {
    pub fn from_quest_difficulty(difficulty: u32) -> Self {
        match difficulty {
            1..=2 => BadgeRarity::Common,
            3..=4 => BadgeRarity::Uncommon,
            5..=6 => BadgeRarity::Rare,
            7..=8 => BadgeRarity::Epic,
            _ => BadgeRarity::Legendary,
        }
    }
    
    pub fn to_color(&self) -> &'static str {
        match self {
            BadgeRarity::Common => "#9CA3AF",
            BadgeRarity::Uncommon => "#10B981",
            BadgeRarity::Rare => "#3B82F6",
            BadgeRarity::Epic => "#8B5CF6",
            BadgeRarity::Legendary => "#F59E0B",
        }
    }
}
