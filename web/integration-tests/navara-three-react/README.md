# @navara/three_react Integration Test

This project tests `@navara/three_react` from an end user's perspective, using the built library files instead of source files.

## What This Tests

- Library exports work correctly
- TypeScript type definitions are properly generated
- React components (ViewProvider, Layer) work correctly
- WASM modules load correctly
- Basic functionality (globe rendering, layers, camera) works with React

## Running

```bash
# Development mode (from repository root)
pnpm dev:integration

# Or from this directory
pnpm dev
```

## Building

```bash
# Production build (from repository root)
pnpm build:integration

# Or from this directory
pnpm build
```

## Example Code

The `src/` directory contains a React application that:

1. Creates a `ViewProvider` context with shadow and debug enabled
2. Uses the `useViewContext` hook to access the view
3. Adds default atmosphere and effect descriptors via custom hook
4. Renders terrain, tiles, and 3D building layers using the `Layer` component
5. Demonstrates the declarative React API for managing layers

This exercises the core React integration functionality that users would typically use.
