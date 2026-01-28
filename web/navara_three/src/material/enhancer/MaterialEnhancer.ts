import {
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { ShaderLib as ThreeShaderLib } from "three";

// Re-export ShaderLib for convenience
export const ShaderLib = ThreeShaderLib;

// Mapping from shader names to their corresponding material classes
type ShaderToMaterial = {
  basic: MeshBasicMaterial;
  lambert: MeshLambertMaterial;
  phong: MeshPhongMaterial;
  standard: MeshStandardMaterial;
  physical: MeshPhysicalMaterial;
};

// All shader names that have material mappings
export type ShaderName = keyof ShaderToMaterial;

// Helper type: Extract material union from shader name array
export type MaterialsFromShaders<S extends readonly ShaderName[]> =
  ShaderToMaterial[S[number]];

/**
 * Type alias for shader uniforms.
 */
export type ShaderUniforms = WebGLProgramParametersWithUniforms["uniforms"];

/**
 * Generic Mutates type - refs must be updated by states.
 * All mutates have:
 * - `update(state)`: Syncs internal refs from state
 * - `updateUniforms(uniforms, state)`: Assigns internal refs to shader.uniforms
 * Additional methods can be added via the Methods type parameter.
 */
export type Mutates<
  States,
  Methods extends Record<string, (...args: never[]) => void> = Record<
    string,
    never
  >,
> = {
  update: (states: States) => void;
  updateUniforms: (uniforms: ShaderUniforms, states: States) => void;
} & Methods;

/**
 * Core abstraction: Material enhancer with shader type constraints
 *
 * A MaterialEnhancer encapsulates a single material feature and declares which shaders it supports.
 *
 * The enhancer separates concerns into three categories:
 * - **State** (immutable): Configuration flags and values that define behavior.
 *   Always replaced as a whole when updated (never mutated). Returned directly via `states()`.
 * - **Refs** (mutable, internal): Uniform value objects (`{ value: T }`) that are shared
 *   references with shader.uniforms. Hidden inside mutates, synced from state via `mutates().update(state)`.
 * - **Mutates** (mutation functions): Functions exposed via `mutates()` for controlled
 *   mutation of internal refs. Always includes `update(state)` to sync refs from state.
 *
 * The material is passed to the factory function when creating the enhancer,
 * and is exposed via the `material` property for composed enhancers to reference.
 */
export type MaterialEnhancer<
  M extends Material,
  Props,
  States = unknown,
  Mutates = unknown,
  Shaders extends readonly ShaderName[] = readonly ShaderName[],
> = {
  /** The Three.js material being enhanced */
  readonly material: M;
  /** Declares which shaders this enhancer is compatible with */
  readonly availableShaders: Shaders;
  /** Called once during shader compilation - assigns internal refs to shader.uniforms */
  transformShader: (shader: WebGLProgramParametersWithUniforms) => void;
  /** Called once after creation - initializes internal state with props */
  mount: (props: Props) => void;
  /** Called on every props update - updates internal state and refs */
  update: (props: Props) => void;
  /** Get the current state directly (no getters - refresh after updates) */
  states: () => States;
  /** Get mutation functions for controlled updates to internal refs */
  mutates: () => Mutates;
  /** Returns cache key based on state affecting shader defines. Used with material.customProgramCacheKey */
  programCacheKey: () => string;
};

/** Enhanced material wrapper */
export type EnhancedMaterial<
  M extends Material,
  Props,
  States = unknown,
  Mutates = unknown,
> = {
  material: M;
  mount: (props: Props) => void;
  update: (props: Props) => void;
  states: () => States;
  mutates: () => Mutates;
};
