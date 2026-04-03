# Navara Developer Documentation

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

This repository contains the developer documentation for Navara, a 3D globe map engine prototype built on Rust + WebAssembly + Three.js.

## 📚 Documentation Structure

The documentation covers three main components of the Navara ecosystem:

- **navara** - Core 3D globe map engine
- **navara_three** - Map engine for manipulating maps on the front-end side, based on Three.js
- **navara_wasm** - WebAssembly components for high-performance map rendering

## 🚀 Project Structure

Inside of this Astro + Starlight project, you'll see the following folders and files:

```
.
├── public/
├── src/
│   ├── assets/
│   ├── content/
│   │   ├── docs/
│   │   │   ├── navara/
│   │   │   ├── navara_three/
│   │   │   ├── navara_wasm/
│   │   │   └── ja/          # Japanese translations
│   │   └── content.config.ts
│   ├── components/
│   ├── styles/
│   └── utils/
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

Starlight looks for `.md` or `.mdx` files in the `src/content/docs/` directory. Each file is exposed as a route based on its file name.

Images can be added to `src/assets/` and embedded in Markdown with a relative link.

Static assets, like favicons, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Contribution

Please read [Writing rules](./guide/WRITING_RULES.md) before your contribution.

## 👀 Want to learn more?

Check out [Starlight’s docs](https://starlight.astro.build/), read [the Astro documentation](https://docs.astro.build), or jump into the [Astro Discord server](https://astro.build/chat).
