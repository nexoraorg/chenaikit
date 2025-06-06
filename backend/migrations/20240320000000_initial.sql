-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    wallet_address CHAR(42) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create quests table
CREATE TABLE quests (
    id UUID PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    requirements JSONB NOT NULL,
    rewards JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_quests table for tracking progress
CREATE TABLE user_quests (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    quest_id UUID NOT NULL REFERENCES quests(id),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    progress JSONB NOT NULL DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, quest_id)
);

-- Create nft_metadata table
CREATE TABLE nft_metadata (
    id UUID PRIMARY KEY,
    token_id BIGINT NOT NULL UNIQUE,
    token_type VARCHAR(20) NOT NULL, -- 'character' or 'badge'
    owner_id UUID NOT NULL REFERENCES users(id),
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
); 