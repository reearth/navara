# Material Enhancer Pattern

A compositional pattern for Three.js materials that separates shader logic into testable, composable units.

## Problem

Three.js materials with multiple shader features become monolithic — all shader modifications interleaved in a single class, making code **hard to test in isolation**. You cannot unit-test one shader feature without the entire material setup, and GPU uniform objects (`{ value: T }`) are mutable shared state that easily breaks when accessed from multiple places.

## Solution: Testable Separation of Concerns

The Material Enhancer pattern splits material logic into three layers, each testable independently:

| Layer       | What it holds                                       | Testability benefit                           |
| ----------- | --------------------------------------------------- | --------------------------------------------- |
| **State**   | Immutable config snapshot (replaced on each update) | Assert state transitions with simple equality |
| **Refs**    | Mutable `{ value: T }` uniform objects for the GPU  | Hidden in closure — cannot leak into tests    |
| **Mutates** | Functions that sync refs from state                 | Test ref-syncing logic without a real shader  |

The key insight: **state and refs serve different purposes**. State is a clean, serializable snapshot for comparison and assertions. Refs are GPU implementation details that must be mutated in place. By hiding refs behind mutates functions, each layer can be tested without the others.

## API

```typescript
type MaterialEnhancer<M, Props, States, Mutates, Shaders> = {
  material: M;
  availableShaders: Shaders;
  mount(props: Props): void; // Initialize state + refs
  update(props: Props): void; // Update state, sync refs (no recompilation)
  transformShader(shader): void; // Inject custom GLSL + assign uniforms
  states(): States; // Read current state (for assertions)
  mutates(): Mutates; // Access controlled mutation functions
  programCacheKey(): string; // Cache key for shader define changes
};
```

### Lifecycle

```
1. Create material + enhancer
2. mount(props)                           → initializes state and refs
3. material.onBeforeCompile = enhancer.transformShader
4. Three.js calls transformShader()       → injects GLSL, assigns uniforms
5. update(props)                          → updates state, syncs refs (no recompilation)
```

**Constraint**: All methods except `mount()` throw if called before `mount()` (enforced with `invariant`). The factory returns an uninitialized enhancer.

**Note**: `states()` returns the current internal state object. After calling `update()`, call `states()` again to get the latest snapshot.

## Factory Pattern

Enhancers use factory functions. State and refs are closure-private:

```typescript
function createFeatureEnhancer(material: MeshLambertMaterial) {
  let state: FeatureState | null = null;
  let mutates: FeatureMutates | null = null;

  return {
    material,
    availableShaders: ["lambert"] as const,

    mount: (props) => {
      state = {
        featureEnabled: props.featureEnabled ?? false,
        intensity: props.intensity ?? 1.0,
      };
      mutates = createMutates(); // refs created inside, captured in closure
      mutates.update(state);
    },

    update: (props) => {
      const prev = state.featureEnabled;
      state = { ...state, ...props };
      mutates.update(state); // sync refs from new state
      if (state.featureEnabled !== prev) material.needsUpdate = true;
    },

    transformShader: (shader) => {
      if (state.featureEnabled) shader.defines.FEATURE_X = 1;
      mutates.updateUniforms(shader.uniforms, state);
    },

    states: () => state,
    mutates: () => mutates,
    programCacheKey: () =>
      JSON.stringify({ featureEnabled: state?.featureEnabled }),
  };
}
```

### Refs Management (inside `createMutates`)

```typescript
const createMutates = (): FeatureMutates => {
  const refs = { uIntensity: { value: 1.0 } }; // private to closure
  return {
    update: (state) => {
      refs.uIntensity.value = state.intensity;
    },
    updateUniforms: (uniforms, state) => {
      uniforms.uIntensity = refs.uIntensity;
    },
  };
};
```

This is the core testability mechanism. Each module can be tested in isolation:

```typescript
// Test state transitions (state.test.ts)
const state = updateState({ intensity: 0.5 }, DEFAULT_STATE);
expect(state.intensity).toBe(0.5);

// Test ref syncing (mutates.test.ts)
const mutates = createMutates();
mutates.update({ intensity: 0.7 });
const uniforms: Record<string, unknown> = {};
mutates.updateUniforms(uniforms);
expect((uniforms.uIntensity as { value: number }).value).toBe(0.7);

// Test shader injection (shader.test.ts)
const mockShader = {
  defines: {},
  uniforms: {},
  vertexShader: "...",
  fragmentShader: "...",
};
transformShader(state, mutates, mockShader);
expect(mockShader.defines.FEATURE_X).toBe(1);
```

Each file (`state.ts`, `mutates.ts`, `shader.ts`) has a co-located `.test.ts` file.

### Shader Compatibility Testing

Three.js has some built-in shader types, each with different structure. An enhancer declares which shaders it supports via `availableShaders`. The shared test utility `testShaderCompatibility` automatically generates a test matrix across all supported shaders and prop configurations:

```typescript
// shader.test.ts
testShaderCompatibility(
  "featureEnhancer",
  (material) => createFeatureEnhancer(material as SupportedMaterial),
  [
    { name: "Feature enabled", props: { featureEnabled: true } },
    { name: "Feature disabled", props: { featureEnabled: false } },
  ],
  FEATURE_SHADER_MARKERS,
);
```

For each (shader type x props) combination, `testShaderCompatibility` verifies:

1. `mount(props)` + `transformShader()` does not throw
2. `update(props)` + `transformShader()` does not throw
3. All declared markers are present in the transformed shader output

This ensures enhancers work correctly across all Three.js shader types without writing repetitive per-shader tests.

## Composition

Enhancers compose by wrapping a base enhancer. Each layer delegates to its base:

```typescript
function createComposedEnhancer(baseEnhancer) {
  let state = null,
    mutates = null;
  return {
    mount: (props) => {
      baseEnhancer.mount(props.base ?? {}); // delegate to base
      state = createInitialState(props.feature);
      mutates = createComposedMutates();
      mutates.update(state);
    },
    transformShader: (shader) => {
      baseEnhancer.transformShader(shader); // base injects first
      if (state.featureEnabled) shader.defines.FEATURE_Y = 1;
      mutates.updateUniforms(shader.uniforms, state);
    },
    update: (props) => {
      if (props.base) baseEnhancer.update(props.base);
      if (props.feature) {
        const prev = state.featureEnabled;
        state = updateState(props.feature, state);
        mutates.update(state);
        if (state.featureEnabled !== prev) material.needsUpdate = true;
      }
    },
    states: () => ({ base: baseEnhancer.states(), feature: state }),
    mutates: () => ({ base: baseEnhancer.mutates() }),
    programCacheKey: () =>
      baseEnhancer.programCacheKey() +
      JSON.stringify({ featureEnabled: state?.featureEnabled }),
  };
}
```

## Shader Modification: Replacer vs ShaderReplacer

Two utilities handle shader string manipulation. They serve different roles in the composition chain:

| Aspect                | `Replacer`                            | `ShaderReplacer<Markers>`                           |
| --------------------- | ------------------------------------- | --------------------------------------------------- |
| **Used by**           | Base enhancer only                    | Composing enhancers only                            |
| **Search by**         | Arbitrary string / regex              | Declared markers only (type-safe)                   |
| **Operations**        | `replace()`, `replaceWithCondition()` | `insertBefore()`, `insertAfter()`, `replaceBlock()` |
| **Preserves markers** | N/A                                   | Yes — markers remain after every operation          |

### Base enhancer: `Replacer`

The base enhancer is the first in the chain, so there are no markers yet. It uses `Replacer` to replace Three.js `#include` directives with custom GLSL and **places markers** at insertion points for composing enhancers:

```typescript
// Base enhancer's shader.ts — uses Replacer to build initial shader + place markers
shader.fragmentShader = createReplacer(shader.fragmentShader).replace(
  "uniform vec3 diffuse;",
  `${MARKERS.fragment.UNIFORM_START}
uniform vec3 diffuse;
uniform bool uClampToGround;
${MARKERS.fragment.UNIFORM_END}`,
).source;
```

### Composing enhancer: `ShaderReplacer`

Composing enhancers operate on the base enhancer's output, which already contains markers. `ShaderReplacer<Markers>` restricts operations to declared markers at the type level, preventing accidental modifications to arbitrary shader code:

```typescript
// Composing enhancer's shader.ts — uses ShaderReplacer, restricted to base markers
shader.fragmentShader = createFeatureShaderReplacer(shader.fragmentShader)
  .insertAfter(MARKERS.fragment.UNIFORM_END, "uniform float uFoo;")
  .replaceBlock(
    {
      start: MARKERS.fragment.UNIFORM_START,
      end: MARKERS.fragment.UNIFORM_END,
    },
    "uniform float uBar;",
  ).source;
```

### Markers

Markers are GLSL comments defined in `markers.ts` and organized by shader stage:

```typescript
const MARKERS = {
  vertex: {},
  fragment: {
    UNIFORM_START: "// NVR_FEATURE_UNIFORM_START",
    UNIFORM_END: "// NVR_FEATURE_UNIFORM_END",
  },
} as const satisfies ShaderMarkers;
```

Each base enhancer exposes a typed factory (e.g., `createFeatureShaderReplacer`) that returns a `ShaderReplacer` restricted to its markers. All `ShaderReplacer` operations preserve markers and return `this` for chaining.

## External Refs

Some uniforms (e.g., shared textures) are created externally and passed via props. The enhancer must hold the same `{ value: T }` object reference to receive future external mutations:

```typescript
setTexture: (texture: UniformValue<Texture | null>) => {
  refs.uTexture = texture; // assign the ref object, not just the value
},
```

## Shader Defines and Recompilation

State properties that affect `#define` flags follow two patterns:

- **Immutable after mount**: Cannot change after initialization (e.g., `useRTE`).
- **Mutable with recompilation**: Can change; triggers `material.needsUpdate = true` and must be included in `programCacheKey()`.

## Type Conventions

Each enhancer defines four types:

```typescript
type FeatureProps = { ... };                         // Input (public)
type FeatureState = Readonly<{ ... }>;               // Immutable snapshot (public)
type FeatureMutates = Mutates<FeatureState, { ... }>; // Mutation interface (public)
type FeatureRefs = { ... };                          // Uniform references (internal)
```

## File Organization

```
/featureEnhancer
  index.ts    - Factory function + public type re-exports
  types.ts    - Props, State, Mutates type definitions
  mutates.ts  - createMutates, Refs type, default ref values (use structuredClone for defaults)
  state.ts    - State transitions and default values
  shader.ts   - transformShader logic
  material.ts - Supported material types and shader compatibility
  markers.ts  - Marker constants and typed ShaderReplacer factory
```

Each module has a co-located `*.test.ts` file (e.g., `state.test.ts`, `mutates.test.ts`, `shader.test.ts`) if it has a logic.
