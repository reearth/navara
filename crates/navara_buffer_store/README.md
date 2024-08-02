# Navara BufferStore Plugin

This is a plugin for BufferStore. BufferStore will be used in the following situation.

- Share a large data through WASM.
- Avoid loading a large data from memory frequently, for example, you want to store the data in the struct that is accessed every frame.
