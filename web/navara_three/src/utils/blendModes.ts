import { BlendFunction } from "postprocessing";

export type navaraBlendMode = "skip" | "set" | "add" | "alpha" | "average" | "color" | "colorBurn" | "colorDodge" | "darken" | "difference" | "divide" | "dst" | "exclusion" | "hardLight" | "hardMix" | "hue" | "invert" | "invertRgb" | "lighten" | "linearBurn" | "linearDodge" | "linearLight" | "luminosity" | "multiply" | "negation" | "normal" | "overlay" | "pinLight" | "reflect" | "saturation" | "screen" | "softLight" | "src" | "subtract" | "vividLight";

const BLEND_MAP: Record<navaraBlendMode, BlendFunction> = {
    skip: BlendFunction.SKIP,
    set: BlendFunction.SET,
    add: BlendFunction.ADD,
    alpha: BlendFunction.ALPHA,
    average: BlendFunction.AVERAGE,
    color: BlendFunction.COLOR,
    colorBurn: BlendFunction.COLOR_BURN,
    colorDodge: BlendFunction.COLOR_DODGE,
    darken: BlendFunction.DARKEN,
    difference: BlendFunction.DIFFERENCE,
    divide: BlendFunction.DIVIDE,
    dst: BlendFunction.DST,
    exclusion: BlendFunction.EXCLUSION,
    hardLight: BlendFunction.HARD_LIGHT,
    hardMix: BlendFunction.HARD_MIX,
    hue: BlendFunction.HUE,
    invert: BlendFunction.INVERT,
    invertRgb: BlendFunction.INVERT_RGB,
    lighten: BlendFunction.LIGHTEN,
    linearBurn: BlendFunction.LINEAR_BURN,
    linearDodge: BlendFunction.LINEAR_DODGE,
    linearLight: BlendFunction.LINEAR_LIGHT,
    luminosity: BlendFunction.LUMINOSITY,
    multiply: BlendFunction.MULTIPLY,
    negation: BlendFunction.NEGATION,
    normal: BlendFunction.NORMAL,
    overlay: BlendFunction.OVERLAY,
    pinLight: BlendFunction.PIN_LIGHT,
    reflect: BlendFunction.REFLECT,
    saturation: BlendFunction.SATURATION,
    screen: BlendFunction.SCREEN,
    softLight: BlendFunction.SOFT_LIGHT,
    src: BlendFunction.SRC,
    subtract: BlendFunction.SUBTRACT,
    vividLight: BlendFunction.VIVID_LIGHT,
};

export function blendFunction(mode: navaraBlendMode): BlendFunction {
    return BLEND_MAP[mode] ?? BlendFunction.SRC;
}