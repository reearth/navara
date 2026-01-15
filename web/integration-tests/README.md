# Integration Tests

This directory contains integration test projects that test Navara packages from a user's perspective. Unlike the development examples in `navara_three/example`, these tests use the **built library files** (from `dist/`) rather than source files.

## Purpose

These integration tests help catch issues that only appear when consuming the library as an end user:

- Missing or incorrect TypeScript type definitions (`.d.ts` files)
- Bundling issues (missing exports, incorrect module resolution)
- WASM loading problems in production builds
- Peer dependency issues

## Project Structure

```
integration-tests/
├── navara-three              # Integration test for @navara/three
└── navara-three-react        # Integration test for @navara/three_react
```

## Prerequisites

Before running integration tests, ensure the library packages are built:

```bash
# From repository root
cargo make build
# or
pnpm build
```

## Running Tests

### Development Mode

Run the integration test with hot-reload:

```bash
# From repository root
pnpm dev:integration

# Or using cargo-make
cargo make dev-web-integration
```

### Production Build

Build the integration tests to verify production bundling works:

```bash
# From repository root
pnpm build:integration

# Or using cargo-make (includes WASM build)
cargo make build-integration
```

### Preview Production Build

After building, preview the production output:

```bash
cd web/integration-tests/navara-three
pnpm preview
```

## Adding New Integration Tests

To add a new integration test (e.g., for a future `@navara/babylon` package):

1. Create a new directory under `integration-tests/`:
   ```
   integration-tests/navara-babylon/
   ```

2. Add a `package.json` with the package as a dependency:
   ```json
   {
     "name": "@navara/integration-test-babylon",
     "dependencies": {
       "@navara/babylon": "workspace:*",
       "@navara/engine": "workspace:*",
       "@navara/engine-api": "workspace:*",
       "@navara/engine-worker": "workspace:*"
     }
   }
   ```

3. Create a minimal example that exercises the library's main functionality.

4. Run `pnpm install` from the repository root to link the new package.

## Difference from Development Examples

| Aspect | Development Examples (`navara_three/example`) | Integration Tests |
|--------|----------------------------------------------|-------------------|
| Source | Uses source files via aliases (dev mode) | Always uses built `dist/` files |
| Purpose | Feature development & showcase | Library packaging validation |
| Hot-reload | Full source-level HMR | Requires library rebuild |
| Type checking | Against source `.ts` files | Against built `.d.ts` files |
