# AGENTS.md

This document provides guidance for AI agents working with the navara-developer-docs codebase.

## Quick Start

| Task                                       | Reference                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| Update navara_three documentation          | [NAVARA_THREE_INSTRUCTIONS.md](./guide/NAVARA_THREE_INSTRUCTIONS.md)         |
| Specific update scenarios                  | [NAVARA_THREE_UPDATE_CHECKLIST.md](./guide/NAVARA_THREE_UPDATE_CHECKLIST.md) |
| Translate documentation to other languages | [TRANSLATION_GUIDE.md](./guide/TRANSLATION_GUIDE.md)                         |
| Rules for writing                          | [WRITING_RULES.md](./guide/WRITING_RULES.md)                         |

## Documentation Structure

```
navara-developer-docs/
├── AGENTS.md                         # This file - entry point for AI agents
├── guide/
│   ├── NAVARA_THREE_INSTRUCTIONS.md  # Comprehensive update guide
│   ├── NAVARA_THREE_UPDATE_CHECKLIST.md  # Scenario-based checklists
│   ├── TRANSLATION_GUIDE.md         # Translation workflow guide
│   └── WRITING_RULES.md             # Rules for writing
└── src/content/docs/                 # Documentation files
    ├── (root)                        # English (default locale)
    ├── ja/                           # Japanese locale
    └── [locale]/                     # Future locales (e.g., zh/, ko/)
```

## Key Principles

1. **Read before writing** - Always read existing documentation to match style and format
2. **Match implementation exactly** - Types, parameters, and return values must match source code
3. **Write in English first** - English is the root locale and source of truth; translations go in locale subdirectories (e.g., `ja/`)
4. **Preserve structure** - Follow existing document organization and heading levels
