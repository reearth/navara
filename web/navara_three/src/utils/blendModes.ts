import { BlendFunction } from "postprocessing";

export type navaraBlendMode = "skip" | "set" | "add" | "alpha" | "average" | "color" | "colorBurn" | "colorDodge" | "darken" | "difference" | "divide" | "dst" | "exclusion" | "hardLight" | "hardMix" | "hue" | "invert" | "invertRgb" | "lighten" | "linearBurn" | "linearDodge" | "linearLight" | "luminosity" | "multiply" | "negation" | "normal" | "overlay" | "pinLight" | "reflect" | "saturation" | "screen" | "softLight" | "src" | "subtract" | "vividLight";

export function blendFunction(mode: navaraBlendMode): BlendFunction {
    switch (mode) {
        case "skip":
            return BlendFunction.SKIP;
        case "set":
            return BlendFunction.SET;
        case "add":
            return BlendFunction.ADD;
        case "alpha":
            return BlendFunction.ALPHA;
        case "average":
            return BlendFunction.AVERAGE;
        case "color":
            return BlendFunction.COLOR;
        case "colorBurn":
            return BlendFunction.COLOR_BURN;
        case "colorDodge":
            return BlendFunction.COLOR_DODGE;
        case "darken":
            return BlendFunction.DARKEN;
        case "difference":
            return BlendFunction.DIFFERENCE;
        case "divide":
            return BlendFunction.DIVIDE;
        case "dst":
            return BlendFunction.DST;
        case "exclusion":
            return BlendFunction.EXCLUSION;
        case "hardLight":
            return BlendFunction.HARD_LIGHT;
        case "hardMix":
            return BlendFunction.HARD_MIX;
        case "hue":
            return BlendFunction.HUE;
        case "invert":
            return BlendFunction.INVERT;
        case "invertRgb":
            return BlendFunction.INVERT_RGB;
        case "lighten":
            return BlendFunction.LIGHTEN;
        case "linearBurn":
            return BlendFunction.LINEAR_BURN;
        case "linearDodge":
            return BlendFunction.LINEAR_DODGE;
        case "linearLight":
            return BlendFunction.LINEAR_LIGHT;
        case "luminosity":
            return BlendFunction.LUMINOSITY;
        case "multiply":
            return BlendFunction.MULTIPLY;
        case "negation":
            return BlendFunction.NEGATION;
        case "normal":
            return BlendFunction.NORMAL;
        case "overlay":
            return BlendFunction.OVERLAY;
        case "pinLight":
            return BlendFunction.PIN_LIGHT;
        case "reflect":
            return BlendFunction.REFLECT;
        case "saturation":
            return BlendFunction.SATURATION;
        case "screen":
            return BlendFunction.SCREEN;
        case "softLight":
            return BlendFunction.SOFT_LIGHT;
        case "src":
            return BlendFunction.SRC;
        case "subtract":
            return BlendFunction.SUBTRACT;
        case "vividLight":
            return BlendFunction.VIVID_LIGHT;
        default:
            return BlendFunction.SRC;
    }
}