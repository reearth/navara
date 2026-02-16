/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Mutates } from "../../MaterialEnhancer";

export type ShadowMapDepthProps = {};

/**
 * Immutable state for the shadow map depth enhancer.
 * This enhancer has no internal state that changes - it just holds external refs.
 */
export type ShadowMapDepthState = Readonly<{}>;

/**
 * Mutable references (uniforms) for the shadow map depth enhancer.
 * These are external refs passed via props.
 */
export type ShadowMapDepthRefs = {};

export type ShadowMapDepthUniforms = Partial<ShadowMapDepthRefs>;

/**
 * Mutation functions for the shadow map depth enhancer.
 */
export type ShadowMapDepthMutates = Mutates<
  ShadowMapDepthState,
  ShadowMapDepthUniforms
>;
