import { BufferView } from "@navaramap/three";
import type { Texture, WebGLRenderer, WebGLRenderTarget } from "three";

/** Convert float pixels to Uint8Array with bitmask color visualization */
function bitmaskToRgba(
  floatPixels: Float32Array,
  pixelCount: number,
): Uint8Array {
  const result = new Uint8Array(pixelCount * 4);
  const bitColors = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
  ];
  for (let p = 0; p < pixelCount; p++) {
    const mask = Math.round(floatPixels[p * 4]);
    let r = 0,
      g = 0,
      b = 0;
    for (let bit = 0; bit < bitColors.length; bit++) {
      if (mask & (1 << bit)) {
        r += bitColors[bit][0];
        g += bitColors[bit][1];
        b += bitColors[bit][2];
      }
    }
    const di = p * 4;
    result[di] = Math.min(255, r);
    result[di + 1] = Math.min(255, g);
    result[di + 2] = Math.min(255, b);
    result[di + 3] = mask > 0 ? 255 : 0;
  }
  return result;
}

/** Convert float pixels to Uint8Array RGB (clamped 0-255) */
function floatRgbToRgba(
  floatPixels: Float32Array,
  pixelCount: number,
): Uint8Array {
  const result = new Uint8Array(pixelCount * 4);
  for (let p = 0; p < pixelCount; p++) {
    const si = p * 4;
    const di = p * 4;
    result[di] = Math.min(255, Math.max(0, Math.round(floatPixels[si] * 255)));
    result[di + 1] = Math.min(
      255,
      Math.max(0, Math.round(floatPixels[si + 1] * 255)),
    );
    result[di + 2] = Math.min(
      255,
      Math.max(0, Math.round(floatPixels[si + 2] * 255)),
    );
    result[di + 3] = 255;
  }
  return result;
}

/** Snapshot of the current G-buffer, re-fetched every frame. */
export type GBufferSnapshot = {
  renderTarget: WebGLRenderTarget;
  effectIdsTexture?: Texture;
  emissiveTexture?: Texture;
};

/**
 * Set up SelectiveEffect buffer debug views using BufferView.
 * Reads HalfFloat MRT attachments and visualizes EffectIds (bitmask) + Emissive (RGB).
 *
 * The render target is rebuilt (and attachment indices shift) whenever the
 * active effects change, so `getGBuffer` is called on every render instead of
 * capturing the target once.
 */
export function setupDebugViews(
  renderer: WebGLRenderer,
  getGBuffer: () => GBufferSnapshot,
): {
  views: {
    effectIds: BufferView;
    emissiveRgb: BufferView;
  };
  renderDebugViews: () => void;
  setEnabled: (enabled: boolean) => void;
} {
  const effectIdsView = new BufferView(150, 100, {
    styleWidth: "150px",
    styleHeight: "100px",
  });
  const emissiveRgbView = new BufferView(150, 100, {
    styleWidth: "150px",
    styleHeight: "100px",
  });

  effectIdsView.canvas.style.left = "0px";
  emissiveRgbView.canvas.style.left = "155px";

  let enabled = true;

  function readMRTFloat(
    gbufferRT: WebGLRenderTarget,
    attachment?: Texture,
  ): Float32Array | null {
    const attachmentIndex =
      attachment === undefined ? -1 : gbufferRT.textures.indexOf(attachment);
    if (attachmentIndex < 0) return null;

    const gl = renderer.getContext();
    if (!(gl instanceof WebGL2RenderingContext)) return null;

    const w = gbufferRT.width;
    const h = gbufferRT.height;
    const pixels = new Float32Array(w * h * 4);
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(gbufferRT);
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + attachmentIndex);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    renderer.setRenderTarget(prevTarget);
    return pixels;
  }

  function renderDebugViews() {
    if (!enabled) return;
    const { renderTarget, effectIdsTexture, emissiveTexture } = getGBuffer();
    const w = renderTarget.width;
    const h = renderTarget.height;

    const effectIdsFloat = readMRTFloat(renderTarget, effectIdsTexture);
    if (effectIdsFloat) {
      effectIdsView.renderFromPixels(
        bitmaskToRgba(effectIdsFloat, w * h),
        w,
        h,
      );
    }

    const emissiveFloat = readMRTFloat(renderTarget, emissiveTexture);
    if (emissiveFloat) {
      emissiveRgbView.renderFromPixels(
        floatRgbToRgba(emissiveFloat, w * h),
        w,
        h,
      );
    }
  }

  function setEnabled(v: boolean) {
    enabled = v;
    effectIdsView.canvas.style.display = v ? "block" : "none";
    emissiveRgbView.canvas.style.display = v ? "block" : "none";
  }

  return {
    views: {
      effectIds: effectIdsView,
      emissiveRgb: emissiveRgbView,
    },
    renderDebugViews,
    setEnabled,
  };
}
