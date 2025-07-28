pub mod user;

pub mod quest;
pub mod nft;
pub mod progress;

// Quest and NFT models will be added when needed

pub struct Quest {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub code_template: String,
    pub tests: String,
    pub requirements: serde_json::Value,
    pub rewards: serde_json::Value,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

