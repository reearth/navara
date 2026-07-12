use bevy_ecs::prelude::Resource;
use rustc_hash::FxHashMap;

#[derive(Debug)]
pub enum BufferType {
    U8,
    U32,
    F32,
}

#[derive(Debug)]
pub enum Buffer {
    U8(Vec<u8>),
    U32(Vec<u32>),
    F32(Vec<f32>),
    F64(Vec<f64>),
}

impl Buffer {
    /// Heap bytes held by this buffer. Uses `capacity()` rather than `len()`
    /// because capacity is what the WASM linear memory actually holds.
    pub fn byte_len(&self) -> usize {
        match self {
            Buffer::U8(b) => b.capacity(),
            Buffer::U32(b) => b.capacity() * size_of::<u32>(),
            Buffer::F32(b) => b.capacity() * size_of::<f32>(),
            Buffer::F64(b) => b.capacity() * size_of::<f64>(),
        }
    }
}

pub type Handle = i32;

#[derive(Debug, Default, Resource)]
pub struct BufferStore {
    buffers: FxHashMap<Handle, Buffer>,
    counter: Handle,
    total_bytes: usize,
}

impl BufferStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn len(&self) -> usize {
        self.buffers.len()
    }

    pub fn is_empty(&self) -> bool {
        self.buffers.is_empty()
    }

    pub fn total_bytes(&self) -> usize {
        self.total_bytes
    }

    /// Recomputes the byte total from scratch. Used by debug assertions to
    /// verify the incremental accounting never drifts.
    pub fn recomputed_total_bytes(&self) -> usize {
        self.buffers.values().map(|b| b.byte_len()).sum()
    }

    fn insert(&mut self, handle: Handle, buffer: Buffer) {
        self.total_bytes += buffer.byte_len();
        if let Some(old) = self.buffers.insert(handle, buffer) {
            self.total_bytes -= old.byte_len();
        }
    }

    fn take(&mut self, handle: &Handle) -> Option<Buffer> {
        let old = self.buffers.remove(handle)?;
        self.total_bytes -= old.byte_len();
        Some(old)
    }

    pub fn get_u8(&self, handle: &Handle) -> Option<&[u8]> {
        match self.buffers.get(handle)? {
            Buffer::U8(b) => Some(b),
            _ => None,
        }
    }

    pub fn get_u32(&self, handle: &Handle) -> Option<&[u32]> {
        match self.buffers.get(handle)? {
            Buffer::U32(b) => Some(b),
            _ => None,
        }
    }

    pub fn get_f32(&self, handle: &Handle) -> Option<&[f32]> {
        match self.buffers.get(handle)? {
            Buffer::F32(b) => Some(b),
            _ => None,
        }
    }

    pub fn get_f64(&self, handle: &Handle) -> Option<&[f64]> {
        match self.buffers.get(handle)? {
            Buffer::F64(b) => Some(b),
            _ => None,
        }
    }

    pub fn set_u8(&mut self, handle: Handle, data: Vec<u8>) {
        self.insert(handle, Buffer::U8(data));
    }

    pub fn set_u32(&mut self, handle: Handle, data: Vec<u32>) {
        self.insert(handle, Buffer::U32(data));
    }

    pub fn set_f32(&mut self, handle: Handle, data: Vec<f32>) {
        self.insert(handle, Buffer::F32(data));
    }

    pub fn set_f64(&mut self, handle: Handle, data: Vec<f64>) {
        self.insert(handle, Buffer::F64(data));
    }

    pub fn new_u8(&mut self, data: Vec<u8>) -> Handle {
        let handle = self.new_handle();
        self.set_u8(handle, data);
        handle
    }

    pub fn new_u32(&mut self, data: Vec<u32>) -> Handle {
        let handle = self.new_handle();
        self.set_u32(handle, data);
        handle
    }

    pub fn new_f32(&mut self, data: Vec<f32>) -> Handle {
        let handle = self.new_handle();
        self.set_f32(handle, data);
        handle
    }

    pub fn new_f64(&mut self, data: Vec<f64>) -> Handle {
        let handle = self.new_handle();
        self.set_f64(handle, data);
        handle
    }

    pub fn remove(&mut self, handle: &Handle) {
        self.take(handle);
    }

    pub fn remove_f32(&mut self, handle: &Handle) -> Option<Vec<f32>> {
        match self.take(handle)? {
            Buffer::F32(b) => Some(b),
            _ => None,
        }
    }

    pub fn remove_f64(&mut self, handle: &Handle) -> Option<Vec<f64>> {
        match self.take(handle)? {
            Buffer::F64(b) => Some(b),
            _ => None,
        }
    }

    pub fn remove_u32(&mut self, handle: &Handle) -> Option<Vec<u32>> {
        match self.take(handle)? {
            Buffer::U32(b) => Some(b),
            _ => None,
        }
    }

    pub fn remove_u8(&mut self, handle: &Handle) -> Option<Vec<u8>> {
        match self.take(handle)? {
            Buffer::U8(b) => Some(b),
            _ => None,
        }
    }

    pub fn get(&self, handle: &Handle) -> Option<&Buffer> {
        self.buffers.get(handle)
    }

    pub fn contains(&self, handle: &Handle) -> bool {
        self.buffers.contains_key(handle)
    }

    pub fn new_handle(&mut self) -> Handle {
        self.counter += 1;
        self.counter
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn recomputed_bytes(store: &BufferStore) -> usize {
        store.buffers.values().map(|b| b.byte_len()).sum()
    }

    #[test]
    fn accounts_bytes_for_each_type() {
        let mut store = BufferStore::new();
        let h_u8 = store.new_u8(vec![0u8; 10]);
        let h_u32 = store.new_u32(vec![0u32; 10]);
        let h_f32 = store.new_f32(vec![0f32; 10]);
        let h_f64 = store.new_f64(vec![0f64; 10]);
        assert_eq!(store.total_bytes(), recomputed_bytes(&store));
        assert!(store.total_bytes() >= 10 + 40 + 40 + 80);

        store.remove(&h_u8);
        assert!(store.remove_u32(&h_u32).is_some());
        assert!(store.remove_f32(&h_f32).is_some());
        assert!(store.remove_f64(&h_f64).is_some());
        assert_eq!(store.total_bytes(), 0);
    }

    #[test]
    fn replacing_same_handle_does_not_double_count() {
        let mut store = BufferStore::new();
        let handle = store.new_u8(vec![0u8; 100]);
        store.set_u8(handle, vec![0u8; 50]);
        assert_eq!(store.total_bytes(), recomputed_bytes(&store));
        store.set_f32(handle, vec![0f32; 25]);
        assert_eq!(store.total_bytes(), recomputed_bytes(&store));
        store.remove(&handle);
        assert_eq!(store.total_bytes(), 0);
    }

    #[test]
    fn typed_remove_with_wrong_type_still_unaccounts() {
        let mut store = BufferStore::new();
        let handle = store.new_u8(vec![0u8; 100]);
        // Wrong-typed remove drops the buffer and returns None (existing
        // behavior); the bytes must still be un-accounted.
        assert!(store.remove_f32(&handle).is_none());
        assert!(!store.contains(&handle));
        assert_eq!(store.total_bytes(), 0);
    }

    #[test]
    fn removing_missing_handle_is_noop() {
        let mut store = BufferStore::new();
        store.new_u8(vec![0u8; 10]);
        let before = store.total_bytes();
        store.remove(&12345);
        assert!(store.remove_u32(&12345).is_none());
        assert_eq!(store.total_bytes(), before);
    }

    #[test]
    fn total_bytes_matches_recomputation_after_op_sequence() {
        let mut store = BufferStore::new();
        let mut handles = Vec::new();
        for i in 0..50usize {
            let handle = match i % 4 {
                0 => store.new_u8(vec![0u8; i * 3]),
                1 => store.new_u32(vec![0u32; i * 2]),
                2 => store.new_f32(vec![0f32; i]),
                _ => store.new_f64(vec![0f64; i / 2]),
            };
            handles.push(handle);
            // Interleave replacements and removals.
            if i % 5 == 0 && !handles.is_empty() {
                let victim = handles.remove(i % handles.len());
                store.remove(&victim);
            }
            if i % 7 == 0
                && let Some(h) = handles.first()
            {
                store.set_f64(*h, vec![0f64; i]);
            }
            assert_eq!(store.total_bytes(), recomputed_bytes(&store));
        }
    }
}
