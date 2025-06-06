use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::{handlers, services::AppState};

pub fn create_router(app_state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Auth routes
    let auth_routes = Router::new()
        .route("/register", post(handlers::auth::register))
        .route("/login", post(handlers::auth::login));

    // Quest routes
    let quest_routes = Router::new()
        .route("/", get(handlers::quest::list_quests))
        .route("/:id", get(handlers::quest::get_quest))
        .route("/start/:id", post(handlers::quest::start_quest))
        .route("/complete/:id", post(handlers::quest::complete_quest));

    // NFT routes
    let nft_routes = Router::new()
        .route("/metadata/:token_id", get(handlers::nft::get_metadata))
        .route("/mint", post(handlers::nft::mint_nft))
        .route("/transfer", post(handlers::nft::transfer_nft));

    Router::new()
        .route("/health", get(handlers::health::check))
        .nest("/api/auth", auth_routes)
        .nest("/api/quests", quest_routes)
        .nest("/api/nfts", nft_routes)
        .layer(cors)
        .with_state(app_state)
}
