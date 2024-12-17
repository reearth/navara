mod component;
mod delegated_task;
cfg_if! {
    if #[cfg(feature = "delegated_worker")] {
        pub mod delegated_system;
        pub use delegated_system as system;
    } else {
        pub mod system;
    }
}

use cfg_if::cfg_if;
pub use component::*;
pub use delegated_task::*;
