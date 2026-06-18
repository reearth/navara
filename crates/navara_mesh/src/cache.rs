use navara_buffer_store::{BufferStore, Handle};

/// Handles owned by a tile that needs to free them when the tile is destroyed.
///
/// `vertices` / `indices` / `uvs` / `heights` / `normals` are also referenced by
/// the `Mesh` component (so JS can read them), but the tile owns the lifetime —
/// `RasterTile::destroy` calls [`Self::remove_from_buf`] to free them.
///
/// Skirt fields and `watermask` are *only* attached to the `Mesh` component and
/// were previously unfreed when the mesh entity was despawned. Storing them
/// here lets the tile-level destroy clean them up alongside the rest.
#[derive(Debug, Default, Clone)]
pub struct CachedMeshHandle {
    pub vertices: Handle,
    pub indices: Handle,
    pub uvs: Handle,
    pub heights: Option<Handle>,
    /// Optional per-vertex normals (terrain only). Needed for upsample propagation.
    pub normals: Option<Handle>,
    pub skirt_vertices: Option<Handle>,
    pub skirt_uvs: Option<Handle>,
    pub skirt_indices: Option<Handle>,
    pub skirt_indices_to_edge: Option<Handle>,
    pub skirt_normals: Option<Handle>,
    pub watermask: Option<Handle>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remove_from_buf_clears_all_owned_handles() {
        let mut buf = BufferStore::new();

        let cache = CachedMeshHandle {
            vertices: buf.new_f32(vec![0.0; 3]),
            indices: buf.new_u32(vec![0; 3]),
            uvs: buf.new_f32(vec![0.0; 2]),
            heights: Some(buf.new_f32(vec![1.0])),
            normals: Some(buf.new_f32(vec![0.0; 3])),
            skirt_vertices: Some(buf.new_f32(vec![0.0; 3])),
            skirt_uvs: Some(buf.new_f32(vec![0.0; 2])),
            skirt_indices: Some(buf.new_u32(vec![0; 3])),
            skirt_indices_to_edge: Some(buf.new_u32(vec![0; 3])),
            skirt_normals: Some(buf.new_f32(vec![0.0; 3])),
            watermask: Some(buf.new_u8(vec![1])),
        };

        assert_eq!(buf.len(), 11);

        cache.remove_from_buf(&mut buf);

        assert!(buf.is_empty(), "all owned handles should be freed");
    }

    #[test]
    fn remove_from_buf_is_idempotent() {
        let mut buf = BufferStore::new();
        let cache = CachedMeshHandle {
            vertices: buf.new_f32(vec![0.0]),
            indices: buf.new_u32(vec![0]),
            uvs: buf.new_f32(vec![0.0]),
            ..Default::default()
        };
        cache.remove_from_buf(&mut buf);
        // Second call must not panic and leave the store empty.
        cache.remove_from_buf(&mut buf);
        assert!(buf.is_empty());
    }
}

impl CachedMeshHandle {
    /// Free every handle this struct owns. `buf.remove` is idempotent so
    /// double-calls are harmless.
    pub fn remove_from_buf(&self, buf: &mut BufferStore) {
        buf.remove(&self.vertices);
        buf.remove(&self.indices);
        buf.remove(&self.uvs);
        if let Some(h) = self.heights {
            buf.remove(&h);
        }
        if let Some(h) = self.normals {
            buf.remove(&h);
        }
        if let Some(h) = self.skirt_vertices {
            buf.remove(&h);
        }
        if let Some(h) = self.skirt_uvs {
            buf.remove(&h);
        }
        if let Some(h) = self.skirt_indices {
            buf.remove(&h);
        }
        if let Some(h) = self.skirt_indices_to_edge {
            buf.remove(&h);
        }
        if let Some(h) = self.skirt_normals {
            buf.remove(&h);
        }
        if let Some(h) = self.watermask {
            buf.remove(&h);
        }
    }
}
