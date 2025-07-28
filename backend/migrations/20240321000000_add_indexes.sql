-- Add indexes for better query performance

-- Index on user_quests for user_id lookups
CREATE INDEX IF NOT EXISTS idx_user_quests_user_id ON user_quests(user_id);

-- Index on user_quests for quest_id lookups
CREATE INDEX IF NOT EXISTS idx_user_quests_quest_id ON user_quests(quest_id);

-- Index on user_quests for status filtering
CREATE INDEX IF NOT EXISTS idx_user_quests_status ON user_quests(status);

-- Composite index for user progress queries
CREATE INDEX IF NOT EXISTS idx_user_quests_user_status ON user_quests(user_id, status);

-- Index on user_quests for completion date ordering
CREATE INDEX IF NOT EXISTS idx_user_quests_completed_at ON user_quests(completed_at) WHERE completed_at IS NOT NULL;

-- Index on nft_metadata for owner lookups
CREATE INDEX IF NOT EXISTS idx_nft_metadata_owner_id ON nft_metadata(owner_id);

-- Index on nft_metadata for token type filtering
CREATE INDEX IF NOT EXISTS idx_nft_metadata_token_type ON nft_metadata(token_type);

-- Composite index for user NFT queries
CREATE INDEX IF NOT EXISTS idx_nft_metadata_owner_type ON nft_metadata(owner_id, token_type);

-- Index on nft_metadata for token_id lookups
CREATE INDEX IF NOT EXISTS idx_nft_metadata_token_id ON nft_metadata(token_id);

-- Index on quests for created_at ordering
CREATE INDEX IF NOT EXISTS idx_quests_created_at ON quests(created_at);

-- Index on users for wallet_address lookups (already unique, but explicit index)
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Index on users for username lookups (already unique, but explicit index)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Partial index for active user quests
CREATE INDEX IF NOT EXISTS idx_user_quests_active ON user_quests(user_id, quest_id) 
WHERE status IN ('in_progress', 'completed');

-- Index for quest requirements JSONB queries (if we need to query by prerequisites)
CREATE INDEX IF NOT EXISTS idx_quests_requirements_gin ON quests USING GIN (requirements);

-- Index for quest rewards JSONB queries
CREATE INDEX IF NOT EXISTS idx_quests_rewards_gin ON quests USING GIN (rewards);

-- Index for NFT metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_nft_metadata_gin ON nft_metadata USING GIN (metadata);

-- Index for user quest progress JSONB queries
CREATE INDEX IF NOT EXISTS idx_user_quests_progress_gin ON user_quests USING GIN (progress);
