# Navara DataRequester Plugin

This is a plugin for DataRequester. This plugin will be used when you need to do I/O operation and get the response.  
  
This process will work like below.

1. Spawn DataRequester component.
2. The component is inserted to EveneStore.
3. EventStore passes these event values to a rendering engine through WASM API.
4. The rendering engine does I/O process, and get the returned value.
5. The rendering engine sets the returned value to BufferStore.
6. BufferStoreLoadedEvent will be invoked.
7. This I/O process journey is completed.
