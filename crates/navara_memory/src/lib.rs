//! Memory budgeting for tile caches.
//!
//! [`MemoryLedger`] tracks the engine-wide memory usage (exact CPU bytes from
//! [`BufferStore`](navara_buffer_store::BufferStore) plus incrementally-maintained
//! GPU estimates) against an optional budget. When `budget_bytes` is `None`
//! (the default) the budget feature is disabled and tile lifecycles keep their
//! original destroy-on-unvisited behavior.
//!
//! The crate is split into focused modules, all re-exported at the root so the
//! public API is a flat `navara_memory::*`:
//! - [`constants`] — shared memory-policy tuning knobs;
//! - [`cost`] — the [`TileCost`] component and its retention-pool entry;
//! - [`reserve`] — dispatch-time [`ReservedCost`] reservations and the
//!   per-key adaptive [`ReserveEstimates`] estimator;
//! - [`ledger`] — the [`MemoryLedger`] resource and JS-supplied [`CostHints`];
//! - [`pressure`] — the memory-pressure LOD degrade and controller;
//! - [`eviction`] — shared eviction-loop helpers;
//! - [`plugin`] — the frame systems and [`MemoryPlugin`].

pub mod constants;
mod cost;
pub mod eviction;
mod ledger;
mod plugin;
mod pressure;
mod reserve;

pub use constants::*;
pub use cost::*;
pub use ledger::*;
pub use plugin::*;
pub use pressure::*;
pub use reserve::*;
