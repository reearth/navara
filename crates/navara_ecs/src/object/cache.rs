use crate::Handle;

#[derive(Debug, Default, Clone)]
pub struct CachedMeshHandle {
    pub vertices: Handle,
    pub indices: Handle,
    pub uvs: Handle,
    pub heights: Option<Handle>,
}
