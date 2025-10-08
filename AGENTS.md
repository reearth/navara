# Agent.md

This file provides essential guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

Navara is a high-performance 3D globe map engine prototype that combines Rust's computational power with modern web technologies. The project employs a hybrid architecture featuring:

- **Rust Engine** - 40+ specialized crates using Bevy ECS framework for core functionality
- **WebAssembly Bridge** - Three separate WASM modules providing different interfaces  
- **TypeScript Frontend** - Three.js-based rendering with comprehensive web integration
- **cargo-make** - Unified build orchestration across languages

📖 **Detailed Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for comprehensive system design and communication patterns.
📚 **Crate Reference**: See [docs/CRATES.md](docs/CRATES.md) for detailed documentation of all 40+ Rust crates.

## Essential Commands

### Initial Setup
```bash
# Install required development tools
cargo install cargo-make cargo-watch wasm-pack
brew install protobuf  # macOS (or equivalent for other platforms)

# First-time setup - builds WASM modules and installs all dependencies
cargo make prepare
```

### Building
```bash
# Development builds (faster compilation, includes debugging)
cargo make build-dev

# Build example applications
cargo make build-example

# Build only web packages (requires WASM modules to exist)
pnpm build
```

### Testing & Quality Assurance
```bash
# Run all tests (Rust unit tests + TypeScript tests in parallel)
cargo make test

# Linting with automatic fixes
cargo make lint

# Format all code (Rust + TypeScript)
cargo make format
```

## Quick Architecture Reference

### **Three WASM Modules**
1. **`navara_wasm`** - Full 3D engine (40+ crates, stateful ECS system)
2. **`navara_wasm_worker`** - Background processing (terrain mesh, batch processing)  
3. **`navara_wasm_api`** - Lightweight utilities (6 crates, coordinate transforms)

### **TypeScript Packages**
- **`@navara/three`** - Main 3D rendering engine (connects to `navara_wasm`)
- **`@navara/three_api`** - Utility bridge (connects to `navara_wasm_api`)
- **`@navara/core`** - Core utilities and types
- **`@navara/worker`** - Web Worker coordination

## Development Workflow

### Development Workflow for Code Changes

#### **Standard Development Workflow (Recommended)**
For code development without UI testing, use these commands in sequence:

```bash
# Required sequence - run these concurrently when possible
cargo make build-example  # Build examples with latest changes
cargo make format        # Format all code
cargo make lint          # Lint and fix issues
cargo make test          # Run all tests
```

**Important**: Always run all four commands and wait for completion before proceeding. These tasks should be executed concurrently using sub-agents when available.

#### **Web-Only Optimization**
If you're only modifying files under the `web/` directory, you can use web-specific commands:

```bash
# Web-only changes (TypeScript, configs, etc.)
pnpm run build:example  # Build web examples
pnpm run format         # Format web code
pnpm run lint           # Lint web code  
pnpm run test           # Run web tests
```

#### **Critical Rule for Mixed Changes**
**Never skip web builds** even when only modifying the `crates/` directory. WASM binaries change when Rust code changes, which can cause web-side errors. Always include web builds in your workflow.

## Project Structure

### **Key Directories**
- **`/crates/`** - All Rust crates (40+ modules)
- **`/web/`** - TypeScript packages and generated WASM outputs
- **`/shaders/`** - GLSL shader files

### **Build Configuration**
- **`Cargo.toml`** - Rust workspace configuration  
- **`Makefile.toml`** - Main cargo-make configuration
- **`/makes/`** - Specialized build configurations

## Important Development Notes

### **Critical Build Dependencies**
- WASM modules **must be built before** installing web dependencies
- The `cargo make prepare` command enforces correct build sequence
- Hot reload requires waiting for WASM compilation to complete

### **Development Best Practices**
1. Always run `cargo make prepare` for initial setup
2. **For code development**: Use the standard workflow (`cargo make build-example`, `cargo make format`, `cargo make lint`, `cargo make test`) concurrently when possible
3. **Critical**: Never skip web builds even when only modifying Rust crates - WASM changes affect web builds
4. **Web-only optimization**: Use `pnpm run` commands only when exclusively modifying `web/` directory files
5. **Sub-agent usage**: Execute build, format, lint, and test tasks concurrently and wait for all completion
6. Follow the established code formatting and linting standards