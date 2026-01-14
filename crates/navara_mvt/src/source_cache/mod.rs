//! Shared MVT source cache for URL-based tile deduplication.
//!
//! This module provides a centralized registry that maps URLs to shared tile resources,
//! enabling multiple layers with the same URL to share quadtree traversal, tile caching,
//! and network requests.

mod resource;

pub use resource::*;
