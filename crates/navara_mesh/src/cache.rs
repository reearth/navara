use navara_buffer_store::Handle;

#[derive(Debug, Default, Clone)]
pub struct CachedMeshHandle {
    pub vertices: Handle,
    pub indices: Handle,
    pub uvs: Handle,
    pub heights: Option<Handle>,
    /// Optional per-vertex normals (terrain only). Needed for upsample propagation.
    pub normals: Option<Handle>,
    /// Optional quantized-mesh watermask (1 byte uniform or 65536 byte 256x256
    /// grid). Needed for upsample propagation.
    pub watermask: Option<Handle>,
}
