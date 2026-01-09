import { LUT3DEffect, LookupTexture } from "postprocessing";
import type { Camera } from "three";

import { blendFunction, type navaraBlendMode } from "../utils/blendModes";

import { Effect, type EffectOptions } from "./effect";

export type ColorGradingLUTOptions = {
    /** Blend mode of the effect. */
    blendMode?: navaraBlendMode;
    /** Opacity of the effect, only used when blendMode is "add". */
    opacity?: number;
} & EffectOptions;

export class ColorGradingLUT extends Effect<LUT3DEffect, ColorGradingLUTOptions> {

    constructor(camera: Camera, lut: LookupTexture, options?: ColorGradingLUTOptions) {
        super(camera, new LUT3DEffect(lut), options);
    }

    set lut(lut: LookupTexture) {
        if (!this.rawEffect) return;
        if (this.rawEffect.lut) {
            this.rawEffect.lut.dispose();
        }

        this.rawEffect.lut = lut;
        this.emit("_needsUpdate");
    }

    set blendMode(mode: navaraBlendMode) {
        if (!this.rawEffect) return;
        if (this.options?.blendMode === mode) return;

        this.options.blendMode = mode;
        this.rawEffect.blendMode.blendFunction = blendFunction(mode);
        this.emit("_needsUpdate");
    }

    set opacity(value: number) {
        if (!this.rawEffect) return;
        if (this.options?.opacity === value) return;

        this.options.opacity = value;
        this.rawEffect.blendMode.opacity.value = value;
        this.emit("_needsUpdate");
    }

    dispose() {
        if (this.rawEffect && this.rawEffect.lut) {
            this.rawEffect.lut.dispose();
        }
        super.dispose();
    }

    protected onMounted(): void {
        if (!this.rawEffect) return;
        this.rawEffect.blendMode.blendFunction = blendFunction(this.options?.blendMode ?? "src");
        this.rawEffect.blendMode.opacity.value = this.options?.opacity ?? 1.0;
    }

}
