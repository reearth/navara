import type {
  CompositeShaderContributions,
  CompositeSlotContext,
} from "./types";

/**
 * Per-slot marker comment, used by unit tests to assert that a given compact
 * slot maps to the expected absolute slot + region. Exported so tests build
 * the same string the shader emits — single source of truth for the format.
 */
export const compositeSlotMarker = (
  compactSlot: number,
  absoluteSlot: number,
  isVector: boolean,
): string =>
  `// ---- compact slot ${compactSlot} (absolute slot ${absoluteSlot}, ${isVector ? "vector" : "raster"}) ----`;

/**
 * True only in vitest runs (Vite sets MODE="test"). Gates injection of
 * `compositeSlotMarker` comments into the generated shader so production
 * builds (MODE="development" | "production" | undefined for non-Vite
 * consumers) carry no debug comments at all.
 */
const EMIT_SHADER_DEBUG_COMMENTS = import.meta.env?.MODE === "test";

const emitSlotMarker = (
  compactSlot: number,
  absoluteSlot: number,
  isVector: boolean,
): string =>
  EMIT_SHADER_DEBUG_COMMENTS
    ? `  ${compositeSlotMarker(compactSlot, absoluteSlot, isVector)}`
    : "";

/**
 * Default raster sampler: a straight texture fetch tinted by the per-slot color.
 * Composite layer enhancers can override this via
 * `CompositeShaderContributions.sampleProducer` (e.g. the elevation heatmap).
 */
const defaultRasterSampleProducer = ({ k }: CompositeSlotContext): string => `
    vec4 texColor${k} = texture2D(uTextures[${k}], texUv${k}) * vec4(uColors[${k}], 1.0);`;

/**
 * Build the composite-pass fragment shader skeleton, driving the per-slot loop
 * and wiring in feature contributions from the composed layer enhancers.
 *
 * The base owns:
 *   - the `main()` scaffold + the standard local accumulators,
 *   - the core per-slot uniforms (shows/colors/opacities/textures/uv),
 *   - the compact→absolute slot mapping (baked into `winningSlot`),
 *   - the alpha-over blend and the MRT output writes.
 *
 * Everything feature-specific (hillshade, elevation heatmap, water, watermask)
 * flows in through `contributions`, so the skeleton stays expression-agnostic.
 *
 * MRT outputs (WebGL2 layout(location=…)):
 *   0: colorBuffer  — composited diffuse (RGBA)
 *   1: attrBuffer   — packed material attrs (RGBA8):
 *                       r = isWater, g = isTexturized, b = 0,
 *                       a = (winSlot + 1) / 255 — 0 means no winner
 *   2: normalBuffer — hillshade normal in [0,1]; .a = 1 when present, 0 when not.
 */
export function buildCompositeFragmentShader(
  rasterCount: number,
  vectorCount: number,
  texturizedSceneIndexFrom: number,
  contributions: CompositeShaderContributions,
): string {
  const numTextures = rasterCount + vectorCount;

  // Per-slot uniform arrays are elided when numTextures === 0 — GLSL forbids
  // zero-length arrays (`uniform int x[0];` fails to compile). Watermask-only
  // tiles (no raster + no vector layers, but a quantized-mesh watermask) still
  // need to run the shader so the watermask sample reaches attr.r.
  const slotUniforms =
    numTextures > 0
      ? `
uniform int uShows[${numTextures}];
uniform vec3 uColors[${numTextures}];
uniform float uOpacities[${numTextures}];
uniform sampler2D uTextures[${numTextures}];
uniform vec2 uLayerUvOffset[${numTextures}];
uniform vec2 uLayerUvScale[${numTextures}];
${contributions.slotUniformDecls}
`
      : "";

  const declUniforms = `
${slotUniforms}
${contributions.globalUniformDecls}
`;

  const sampleProducer =
    contributions.sampleProducer ?? defaultRasterSampleProducer;

  // For each compact slot k, decide texColor and (conditionally) update winning
  // slot index + per-winner attrs. The absolute slot index is baked in as a
  // GLSL int constant so the TileMesh main shader's per-slot uniform arrays
  // remain addressable by `winIdx` (= attr.a decoded). Last-writer-wins: a later
  // slot's opaque pixel overwrites the winner recorded by earlier slots.
  const slotBlocks = Array.from({ length: numTextures }, (_, k) => {
    const isVector = k >= rasterCount;
    const absSlot = isVector ? texturizedSceneIndexFrom + (k - rasterCount) : k;
    const isTexturizedConst = isVector ? "1.0" : "0.0";
    const ctx: CompositeSlotContext = { k, absSlot, isVector };

    return `
${emitSlotMarker(k, absSlot, isVector)}
  if (uShows[${k}] == 1) {
    vec2 texUv${k} = vUv * uLayerUvScale[${k}] + uLayerUvOffset[${k}];
${sampleProducer(ctx)}
${contributions.perSlotPostSample(ctx)}
    float alpha${k} = texColor${k}.a * uOpacities[${k}];
    if (alpha${k} > 0.01) {
      compositedColor = mix(compositedColor, vec4(texColor${k}.rgb, 1.0), alpha${k});
      winningSlot = ${absSlot};
      isTexturized = ${isTexturizedConst};
${contributions.perSlotOnWinner(ctx)}
    }
  }`;
  }).join("\n");

  return `
precision highp float;
precision highp int;

varying vec2 vUv;

${declUniforms}

${contributions.includes}

layout(location = 0) out vec4 colorBuffer;
layout(location = 1) out vec4 attrBuffer;
layout(location = 2) out vec4 normalBuffer;

void main() {
  vec4 compositedColor = vec4(0.0);
  int winningSlot = -1;
  float isWater = 0.0;
  float isTexturized = 0.0;

  vec3 hillshadeNormal = vec3(0.5, 0.5, 1.0); // neutral upward
  bool hasHillshadeNormal = false;

${slotBlocks}

${contributions.postLoop}

  colorBuffer = compositedColor;

  // Attr.a packs the winning slot index as (idx+1)/255 — 0 means no winner.
  // Main shader: int winIdx = int(round(attr.a * 255.0)) - 1.
  attrBuffer = vec4(
    isWater,
    isTexturized,
    0.0,
    float(winningSlot + 1) / 255.0
  );

  normalBuffer = vec4(hillshadeNormal, hasHillshadeNormal ? 1.0 : 0.0);
}
`;
}

/**
 * Vertex shader for the composite fullscreen quad. `position` and `uv` are
 * auto-injected by three.js for ShaderMaterial — declaring them here causes
 * a redefinition error under glslVersion: GLSL3.
 */
export const COMPOSITE_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;
