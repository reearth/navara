use std::collections::HashMap;

use bevy_ecs::system::Resource;

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
}

pub type Handle = i32;

#[derive(Debug, Default, Resource)]
pub struct BufferStore {
    buffers: HashMap<Handle, Buffer>,
    counter: Handle,
}

impl BufferStore {
    pub fn new() -> Self {
        Self::default()
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

    pub fn get_u8_mut(&mut self, handle: &Handle) -> Option<&mut Vec<u8>> {
        match self.buffers.get_mut(handle)? {
            Buffer::U8(b) => Some(b),
            _ => None,
        }
    }

    pub fn get_u32_mut(&mut self, handle: &Handle) -> Option<&mut Vec<u32>> {
        match self.buffers.get_mut(handle)? {
            Buffer::U32(b) => Some(b),
            _ => None,
        }
    }

    pub fn get_f32_mut(&mut self, handle: &Handle) -> Option<&mut Vec<f32>> {
        match self.buffers.get_mut(handle)? {
            Buffer::F32(b) => Some(b),
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

    pub fn remove(&mut self, handle: &Handle) {
        self.buffers.remove(handle);
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

    fn new_handle(&mut self) -> Handle {
        self.counter += 1;
        self.counter
    }
}
