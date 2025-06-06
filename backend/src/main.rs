use anyhow::Result;
use std::net::SocketAddr;
use tracing::info;

mod config;
mod db;
mod error;
mod handlers;
mod models;
mod routes;
mod services;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Load environment variables
    dotenv::dotenv().ok();

    // Initialize application state
    let app_state = services::AppState::new().await?;

    // Build router
    let router = routes::create_router(app_state);

    // Start server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    info!("Server starting on {}", addr);

    axum::Server::bind(&addr)
        .serve(router.into_make_service())
        .await?;

    Ok(())
}
