use crate::{config::Config, db::DbPool, error::AppError};
use anyhow::Result;
use redis::Client as RedisClient;
use std::sync::Arc;

pub mod auth;
pub mod skill_tree;
pub mod cache;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: DbPool,
    pub redis: RedisClient,
    pub cache: Arc<cache::CacheService>,
}

impl AppState {
    pub async fn new() -> Result<Self> {
        let config = Config::from_env()?;
        let db = crate::db::create_pool(&config.database_url).await?;
        let redis = redis::Client::open(config.redis_url.as_str())?;
        let cache = Arc::new(cache::CacheService::new(redis.clone()));

        Ok(Self {
            config: Arc::new(config),
            db,
            redis,
            cache,
        })
    }
}
