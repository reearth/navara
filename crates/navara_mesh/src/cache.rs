use navara_buffer_store::Handle;

#[derive(Debug, Default, Clone)]
pub struct CachedMeshHandle {
    pub vertices: Handle,
    pub indices: Handle,
    pub uvs: Handle,
    pub heights: Option<Handle>,
    /// Optional per-vertex normals (terrain only). Needed for upsample propagation.
    pub normals: Option<Handle>,
}
