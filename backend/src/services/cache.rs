use anyhow::Result;
use redis::{Client as RedisClient, Commands};
use serde::{Deserialize, Serialize};
use sqlx::types::Uuid;
use std::time::Duration;

use crate::models::progress::UserProgress;

pub struct CacheService {
    redis_client: RedisClient,
}

impl CacheService {
    pub fn new(redis_client: RedisClient) -> Self {
        Self { redis_client }
    }

    /// Cache user progress data with TTL
    pub async fn cache_user_progress(
        &self,
        user_id: Uuid,
        progress: &UserProgress,
        ttl_seconds: u64,
    ) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("user_progress:{}", user_id);
        let serialized = serde_json::to_string(progress)?;
        
        conn.set_ex(&key, serialized, ttl_seconds)?;
        Ok(())
    }

    /// Get cached user progress data
    pub async fn get_cached_user_progress(&self, user_id: Uuid) -> Result<Option<UserProgress>> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("user_progress:{}", user_id);
        
        let cached: Option<String> = conn.get(&key)?;
        match cached {
            Some(data) => {
                let progress: UserProgress = serde_json::from_str(&data)?;
                Ok(Some(progress))
            }
            None => Ok(None),
        }
    }

    /// Invalidate user progress cache
    pub async fn invalidate_user_progress(&self, user_id: Uuid) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("user_progress:{}", user_id);
        conn.del(&key)?;
        Ok(())
    }

    /// Cache quest completion stats
    pub async fn cache_quest_stats(
        &self,
        user_id: Uuid,
        total_quests: u32,
        completion_percentage: f32,
        ttl_seconds: u64,
    ) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("quest_stats:{}", user_id);
        let stats = QuestStatsCache {
            total_quests,
            completion_percentage,
        };
        let serialized = serde_json::to_string(&stats)?;
        
        conn.set_ex(&key, serialized, ttl_seconds)?;
        Ok(())
    }

    /// Get cached quest stats
    pub async fn get_cached_quest_stats(&self, user_id: Uuid) -> Result<Option<(u32, f32)>> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("quest_stats:{}", user_id);
        
        let cached: Option<String> = conn.get(&key)?;
        match cached {
            Some(data) => {
                let stats: QuestStatsCache = serde_json::from_str(&data)?;
                Ok(Some((stats.total_quests, stats.completion_percentage)))
            }
            None => Ok(None),
        }
    }

    /// Cache user overall stats
    pub async fn cache_overall_stats(
        &self,
        user_id: Uuid,
        stats: &crate::models::progress::OverallStats,
        ttl_seconds: u64,
    ) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("overall_stats:{}", user_id);
        let serialized = serde_json::to_string(stats)?;
        
        conn.set_ex(&key, serialized, ttl_seconds)?;
        Ok(())
    }

    /// Get cached overall stats
    pub async fn get_cached_overall_stats(
        &self,
        user_id: Uuid,
    ) -> Result<Option<crate::models::progress::OverallStats>> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("overall_stats:{}", user_id);
        
        let cached: Option<String> = conn.get(&key)?;
        match cached {
            Some(data) => {
                let stats: crate::models::progress::OverallStats = serde_json::from_str(&data)?;
                Ok(Some(stats))
            }
            None => Ok(None),
        }
    }

    /// Cache skill trees data
    pub async fn cache_skill_trees(
        &self,
        user_id: Uuid,
        skill_trees: &[crate::models::progress::SkillTree],
        ttl_seconds: u64,
    ) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("skill_trees:{}", user_id);
        let serialized = serde_json::to_string(skill_trees)?;
        
        conn.set_ex(&key, serialized, ttl_seconds)?;
        Ok(())
    }

    /// Get cached skill trees
    pub async fn get_cached_skill_trees(
        &self,
        user_id: Uuid,
    ) -> Result<Option<Vec<crate::models::progress::SkillTree>>> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("skill_trees:{}", user_id);
        
        let cached: Option<String> = conn.get(&key)?;
        match cached {
            Some(data) => {
                let skill_trees: Vec<crate::models::progress::SkillTree> = serde_json::from_str(&data)?;
                Ok(Some(skill_trees))
            }
            None => Ok(None),
        }
    }

    /// Invalidate all user-related caches
    pub async fn invalidate_user_caches(&self, user_id: Uuid) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let keys = vec![
            format!("user_progress:{}", user_id),
            format!("quest_stats:{}", user_id),
            format!("overall_stats:{}", user_id),
            format!("skill_trees:{}", user_id),
        ];
        
        for key in keys {
            let _: () = conn.del(&key)?;
        }
        
        Ok(())
    }

    /// Set cache expiration for performance monitoring
    pub async fn set_cache_metrics(&self, operation: &str, duration_ms: u64) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("metrics:cache:{}", operation);
        let timestamp = chrono::Utc::now().timestamp();
        
        // Store as a sorted set with timestamp as score
        conn.zadd(&key, timestamp, duration_ms)?;
        
        // Keep only last 100 entries
        conn.zremrangebyrank(&key, 0, -101)?;
        
        Ok(())
    }

    /// Get cache hit rate for monitoring
    pub async fn get_cache_hit_rate(&self, operation: &str) -> Result<f64> {
        let mut conn = self.redis_client.get_connection()?;
        let hits_key = format!("metrics:cache_hits:{}", operation);
        let misses_key = format!("metrics:cache_misses:{}", operation);
        
        let hits: u64 = conn.get(&hits_key).unwrap_or(0);
        let misses: u64 = conn.get(&misses_key).unwrap_or(0);
        
        let total = hits + misses;
        if total == 0 {
            Ok(0.0)
        } else {
            Ok(hits as f64 / total as f64)
        }
    }

    /// Record cache hit
    pub async fn record_cache_hit(&self, operation: &str) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("metrics:cache_hits:{}", operation);
        conn.incr(&key, 1)?;
        conn.expire(&key, 3600)?; // Expire after 1 hour
        Ok(())
    }

    /// Record cache miss
    pub async fn record_cache_miss(&self, operation: &str) -> Result<()> {
        let mut conn = self.redis_client.get_connection()?;
        let key = format!("metrics:cache_misses:{}", operation);
        conn.incr(&key, 1)?;
        conn.expire(&key, 3600)?; // Expire after 1 hour
        Ok(())
    }

    /// Warm up cache for frequently accessed data
    pub async fn warmup_user_cache(
        &self,
        user_id: Uuid,
        progress: &UserProgress,
    ) -> Result<()> {
        // Cache with longer TTL for warmup
        self.cache_user_progress(user_id, progress, 3600).await?; // 1 hour
        self.cache_overall_stats(user_id, &progress.overall_stats, 1800).await?; // 30 minutes
        self.cache_skill_trees(user_id, &progress.skill_trees, 1800).await?; // 30 minutes
        
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
struct QuestStatsCache {
    total_quests: u32,
    completion_percentage: f32,
}

// Cache configuration constants
pub const DEFAULT_CACHE_TTL: u64 = 300; // 5 minutes
pub const LONG_CACHE_TTL: u64 = 1800; // 30 minutes
pub const SHORT_CACHE_TTL: u64 = 60; // 1 minute

// Cache key patterns
pub const USER_PROGRESS_KEY: &str = "user_progress:{}";
pub const QUEST_STATS_KEY: &str = "quest_stats:{}";
pub const OVERALL_STATS_KEY: &str = "overall_stats:{}";
pub const SKILL_TREES_KEY: &str = "skill_trees:{}";
