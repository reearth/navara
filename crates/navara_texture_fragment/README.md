# Navara TextureFragment Plugin

This is a plugin for TextureFragment. This plugin will be used when you need to do I/O operation, but you don't need to get a response value.  
  
This process will work like below.

1. Spawn TextureFragment component.
2. The component is inserted to EveneStore.
3. EventStore passes these event values to a rendering engine through WASM API.
4. The rendering engine does I/O process, and get the returned value.
5. The rendering engine stores the returned value in the rendering engine side.
6. TextureFragmentLoadedEvent will be invoked. Note that this event doesn't have any value, it has just an id for the component.
7. This I/O process journey is completed.
