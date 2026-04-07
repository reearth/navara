# AGENTS.md

This document provides guidance for AI agents working with the Navara documentation site (`docs/`).

## Quick Start

| Task                                       | Reference                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| Update documentation                       | [NAVARA_THREE_INSTRUCTIONS.md](./guide/NAVARA_THREE_INSTRUCTIONS.md)         |
| Specific update scenarios                  | [NAVARA_THREE_UPDATE_CHECKLIST.md](./guide/NAVARA_THREE_UPDATE_CHECKLIST.md) |
| Translate documentation to other languages | [TRANSLATION_GUIDE.md](./guide/TRANSLATION_GUIDE.md)                         |
| Rules for writing                          | [WRITING_RULES.md](./guide/WRITING_RULES.md)                                |

## Documentation Structure

```
docs/
├── AGENTS.md                         # This file - entry point for AI agents
├── guide/                            # Guides for writing and updating docs
└── src/content/docs/                 # Documentation pages
    ├── three/                        # @navara/three
    ├── three_default_layers/         # @navara/three_default_layers
    ├── three_default_plugin/         # @navara/three_default_plugin
    ├── engine/                       # WASM engine
    ├── guides/                       # General project guides
    ├── ja/                           # Japanese locale (mirrors root structure)
    └── [locale]/                     # Future locales (e.g., zh/, ko/)
```

## Key Principles

1. **Read before writing** - Always read existing documentation to match style and format
2. **Match implementation exactly** - Types, parameters, and return values must match source code
3. **Write in English first** - English is the root locale and source of truth; translations go in locale subdirectories (e.g., `ja/`)
4. **Preserve structure** - Follow existing document organization and heading levels
