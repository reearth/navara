use bevy_app::{App, Plugin};

use crate::SourceStore;

/// Registers the [`SourceStore`] resource, which holds the user-supplied source
/// definitions that the data loaders read their fetch config from.
pub struct SourcePlugin;

impl Plugin for SourcePlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(SourceStore::new());
    }
}
