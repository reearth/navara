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

pub type Handle = i32;

#[derive(Debug, Default, Resource)]
pub struct BufferStore {
    buffers: FxHashMap<Handle, Buffer>,
    counter: Handle,
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

    pub fn get_u8(&self, handle: &Handle) -> Option<&[u8]> {
        match self.buffers.get(handle)? {
            Buffer::U8(b) => Some(b),
            _ => None,
        }
    }

    pub fn get_u8_mut(&mut self, handle: &Handle) -> Option<&mut [u8]> {
        match self.buffers.get_mut(handle)? {
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
        self.buffers.insert(handle, Buffer::U8(data));
    }

    pub fn set_u32(&mut self, handle: Handle, data: Vec<u32>) {
        self.buffers.insert(handle, Buffer::U32(data));
    }

    pub fn set_f32(&mut self, handle: Handle, data: Vec<f32>) {
        self.buffers.insert(handle, Buffer::F32(data));
    }

    pub fn set_f64(&mut self, handle: Handle, data: Vec<f64>) {
        self.buffers.insert(handle, Buffer::F64(data));
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
        self.buffers.remove(handle);
    }

    pub fn remove_f32(&mut self, handle: &Handle) -> Option<Vec<f32>> {
        match self.buffers.remove(handle)? {
            Buffer::F32(b) => Some(b),
            _ => None,
        }
    }

    pub fn remove_f64(&mut self, handle: &Handle) -> Option<Vec<f64>> {
        match self.buffers.remove(handle)? {
            Buffer::F64(b) => Some(b),
            _ => None,
        }
    }

    pub fn remove_u32(&mut self, handle: &Handle) -> Option<Vec<u32>> {
        match self.buffers.remove(handle)? {
            Buffer::U32(b) => Some(b),
            _ => None,
        }
    }

    pub fn remove_u8(&mut self, handle: &Handle) -> Option<Vec<u8>> {
        match self.buffers.remove(handle)? {
            Buffer::U8(b) => Some(b),
            _ => None,
        }
    }

    pub fn get(&self, handle: &Handle) -> Option<&Buffer> {
        self.buffers.get(handle)
    }

    pub fn get_mut(&mut self, handle: &Handle) -> Option<&mut Buffer> {
        self.buffers.get_mut(handle)
    }

    pub fn contains(&self, handle: &Handle) -> bool {
        self.buffers.contains_key(handle)
    }

    pub fn new_handle(&mut self) -> Handle {
        self.counter += 1;
        self.counter
    }
}
