# Shaders

This is common shader definitions for each rendering engine. We are developing pluggable rendering system, so a function must be reusable from different rendering engine.

```
shaders
└── glsl
    └── point.frag.glsl
    └── ...
└── wgsl
    └── point.frag.wgsl
    └── ...
```

## How is it compiled?

### Web

We are using [vite-plugin-glsl](https://www.npmjs.com/package/vite-plugin-glsl) to embed the shader in our code. This plugin can allow using `#include` statement in build time.

### Native application

This is sill a planning, but we will use something existing parser, or make our own parser for our situation.

## Development

If you want to add your shader, please make sure that the following things are true.

- The shader must be reusable. This means that you cannot use any rendering specific functionality.
- Add `nvr` prefix to your variable, function and etc. This allows us to identify the variable coming from our shader.
