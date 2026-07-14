# AGENTS.md

Navara is a 3D globe map engine prototype: Rust crates (Bevy ECS) compiled to three WASM modules (`navara_wasm` — full engine, `navara_wasm_worker` — background processing, `navara_wasm_api` — lightweight utilities), consumed by TypeScript packages under `web/` (Three.js rendering). Builds are orchestrated with cargo-make.

## Commands

```bash
# First-time setup (requires cargo-make, cargo-watch, wasm-pack, protobuf)
cargo make prepare        # builds WASM modules, then installs web deps — order matters

# After code changes, run all four (concurrently is fine):
cargo make build-example  # build examples (Rust + WASM + web)
cargo make format         # format all code (Rust + TypeScript)
cargo make lint           # lint with auto-fix
cargo make test           # all tests (Rust + TypeScript)
```

If a change touches only `web/`, the pnpm equivalents are faster: `pnpm run build`, `pnpm run build:example`, `pnpm run format`, `pnpm run lint`, `pnpm run test`.

**Never skip the web build after Rust changes.** WASM binaries are consumed by `web/`, so a Rust-only change can still break web builds and tests.

## Docs

- [guide/ARCHITECTURE.md](guide/ARCHITECTURE.md) — system design and Rust/WASM/TypeScript communication patterns
- [guide/CRATES.md](guide/CRATES.md) — reference for the 40+ Rust crates
- [guide/WASM_API_POLICY.md](guide/WASM_API_POLICY.md) — read before designing TypeScript APIs that wrap WASM
- [docs/AGENTS.md](docs/AGENTS.md) — when working in `docs/` (user-facing documentation site)

## Skills

`.claude/skills/` holds distilled best practices for working with Navara: [navara-usage](.claude/skills/navara-usage/SKILL.md) (how to use `@navara/three` — for application code, examples, and docs snippets), [navara-add-example](.claude/skills/navara-add-example/SKILL.md), and [navara-add-docs-example](.claude/skills/navara-add-docs-example/SKILL.md).

**When to record knowledge in a skill vs. docs:**

- A skill captures the distilled form: API-usage invariants (e.g. init order), gotchas that produce broken code when unknown, decision guides (which API tier to use), and proven recipes (goal → composition). When you uncover such a pattern while working, add it to the relevant skill first — keep entries terse and verified against the implementation, never guessed.
- Knowledge flows **skills → docs**: user-facing content accumulated in skills should then be expanded into the documentation site (`docs/`, published at https://navara-docs.netlify.app/) following its writing rules. Docs are the human-facing, exhaustive form; skills stay the LLM-facing, distilled form.
- Do not reduce skills to link indexes into the docs, and do not duplicate exhaustive API listings into skills — for exact property names and signatures, skills point to the docs site and TypeScript definitions instead.
