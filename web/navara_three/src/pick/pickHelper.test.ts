import { PerspectiveCamera, Vector2, type WebGLRenderer } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MeshCache } from "../type";

import { isClickGesture, PickHelper } from "./pickHelper";

describe("isClickGesture", () => {
  it("accepts a pointerup at the exact pointerdown position", () => {
    expect(isClickGesture(new Vector2(100, 100), new Vector2(100, 100))).toBe(
      true,
    );
  });

  it("accepts small jitter during a click (a few pixels)", () => {
    expect(isClickGesture(new Vector2(100, 100), new Vector2(102, 101))).toBe(
      true,
    );
    expect(isClickGesture(new Vector2(100, 100), new Vector2(97, 103))).toBe(
      true,
    );
  });

  it("accepts travel just under the 5px tolerance", () => {
    // 3-4-5 triangle scaled slightly down: distance ~4.99
    expect(isClickGesture(new Vector2(0, 0), new Vector2(2.99, 3.99))).toBe(
      true,
    );
  });

  it("rejects travel at or beyond the 5px tolerance", () => {
    expect(isClickGesture(new Vector2(0, 0), new Vector2(3, 4))).toBe(false);
    expect(isClickGesture(new Vector2(0, 0), new Vector2(5, 0))).toBe(false);
  });

  it("rejects a clear drag", () => {
    expect(isClickGesture(new Vector2(100, 100), new Vector2(180, 40))).toBe(
      false,
    );
  });

  it("uses euclidean distance, not per-axis deltas", () => {
    // Each axis moved less than 5px but the combined travel exceeds it.
    expect(isClickGesture(new Vector2(0, 0), new Vector2(4, 4))).toBe(false);
  });

  it("accepts a wider travel when given an explicit tolerance (touch taps)", () => {
    expect(isClickGesture(new Vector2(0, 0), new Vector2(20, 0), 30)).toBe(
      true,
    );
    expect(isClickGesture(new Vector2(0, 0), new Vector2(30, 0), 30)).toBe(
      false,
    );
  });
});

/**
 * Renderer stub: just enough of the WebGLRenderer surface for PickHelper.
 * `pixel` is what the next readback returns; `scissors`/`renderCount`
 * record the GPU work a pick performed.
 */
const createRendererStub = () => {
  const state = {
    pixel: [0, 0, 0] as [number, number, number],
    renderCount: 0,
    scissors: [] as { x: number; y: number; w: number; h: number }[],
  };
  const renderer = {
    getContext: () => ({ drawingBufferWidth: 800, drawingBufferHeight: 600 }),
    getPixelRatio: () => 1,
    getClearColor: () => undefined,
    getClearAlpha: () => 1,
    getRenderTarget: () => null,
    setClearColor: () => undefined,
    setRenderTarget: () => undefined,
    clear: () => undefined,
    autoClear: true,
    render: () => {
      state.renderCount++;
    },
    setScissor: (x: number, y: number, w: number, h: number) => {
      state.scissors.push({ x, y, w, h });
    },
    setScissorTest: () => undefined,
    readRenderTargetPixels: (
      _target: unknown,
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      buffer: Uint8Array,
    ) => {
      [buffer[0], buffer[1], buffer[2]] = state.pixel;
      buffer[3] = 255;
    },
  } as unknown as WebGLRenderer;
  return { renderer, state };
};

describe("PickHelper", () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    nextRafId = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallbacks.set(++nextRafId, cb);
      return nextRafId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafCallbacks.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Runs every rAF callback queued so far (one simulated frame). */
  const runFrame = () => {
    const callbacks = [...rafCallbacks.values()];
    rafCallbacks.clear();
    for (const cb of callbacks) cb(0);
  };

  const setup = (opts?: { clickable?: boolean; hoverable?: boolean }) => {
    const element = document.createElement("div");
    const { renderer, state } = createRendererStub();
    const picks: number[][] = [];
    const hovers: number[][] = [];
    // Mutable so tests can flip a gate mid-flight (listener removal).
    const gates = {
      clickable: opts?.clickable ?? true,
      hoverable: opts?.hoverable ?? true,
    };
    const helper = new PickHelper(
      element,
      renderer,
      new PerspectiveCamera(),
      new Map() as MeshCache,
      (arr) => picks.push(arr),
      (arr) => hovers.push(arr),
      () => gates.clickable,
      () => gates.hoverable,
    );
    helper.enablePick(true);

    const pointer = (
      type: string,
      x: number,
      y: number,
      init?: PointerEventInit,
    ) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          clientX: x,
          clientY: y,
          isPrimary: true,
          pointerType: "mouse",
          ...init,
        }),
      );
    return { helper, element, state, picks, hovers, gates, pointer };
  };

  describe("click picking", () => {
    it("decodes the batch id from the pick render", () => {
      const { state, picks, pointer } = setup();
      state.pixel = [0, 1, 2]; // (0 << 16) + (1 << 8) + 2

      pointer("pointerdown", 100, 100);
      pointer("pointerup", 100, 100);

      expect(picks).toEqual([[258]]);
      expect(state.renderCount).toBe(1);
    });

    it("reports an empty pick for a miss (batch id 0)", () => {
      const { picks, pointer } = setup();

      pointer("pointerdown", 100, 100);
      pointer("pointerup", 100, 100);

      expect(picks).toEqual([[]]);
    });

    it("limits GPU work to the clicked pixel via scissor", () => {
      const { state, pointer } = setup();

      pointer("pointerdown", 30, 40);
      pointer("pointerup", 30, 40);

      // y is flipped into WebGL space: 600 - 1 - 40.
      expect(state.scissors).toEqual([{ x: 30, y: 559, w: 1, h: 1 }]);
    });

    it("does not pick when the gesture is a drag", () => {
      const { state, picks, pointer } = setup();

      pointer("pointerdown", 100, 100);
      pointer("pointerup", 150, 150);

      expect(picks).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("skips the pick render entirely when nobody listens", () => {
      const { state, picks, pointer } = setup({ clickable: false });

      pointer("pointerdown", 100, 100);
      pointer("pointerup", 100, 100);

      expect(picks).toEqual([]);
      expect(state.renderCount).toBe(0);
    });
  });

  describe("touch tap picking", () => {
    const touch = { pointerType: "touch" } as const;

    it("picks on a single-finger tap", () => {
      const { state, picks, pointer } = setup();
      state.pixel = [0, 0, 9];

      pointer("pointerdown", 100, 100, touch);
      pointer("pointerup", 100, 100, touch);

      expect(picks).toEqual([[9]]);
      expect(state.renderCount).toBe(1);
    });

    it("tolerates finger jitter beyond the mouse click tolerance", () => {
      const { picks, pointer } = setup();

      // 20px of travel: a drag for a mouse, still a tap for a finger.
      pointer("pointerdown", 100, 100, touch);
      pointer("pointerup", 120, 100, touch);

      expect(picks).toEqual([[]]);
    });

    it("rejects travel beyond the tap tolerance", () => {
      const { state, picks, pointer } = setup();

      pointer("pointerdown", 100, 100, touch);
      pointer("pointerup", 140, 100, touch);

      expect(picks).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("keeps the stricter tolerance for the mouse", () => {
      const { state, picks, pointer } = setup();

      pointer("pointerdown", 100, 100);
      pointer("pointerup", 120, 100);

      expect(picks).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("does not pick when a second finger joins (pinch)", () => {
      const { state, picks, pointer } = setup();

      pointer("pointerdown", 100, 100, touch);
      pointer("pointerdown", 120, 100, { ...touch, isPrimary: false });
      pointer("pointerup", 120, 100, { ...touch, isPrimary: false });
      pointer("pointerup", 100, 100, touch);

      expect(picks).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("does not pick when the browser cancels the gesture", () => {
      const { state, picks, pointer } = setup();

      pointer("pointerdown", 100, 100, touch);
      pointer("pointercancel", 100, 100, touch);
      pointer("pointerup", 100, 100, touch);

      expect(picks).toEqual([]);
      expect(state.renderCount).toBe(0);
    });
  });

  describe("hover picking", () => {
    it("picks at most once per animation frame, at the latest position", () => {
      const { state, hovers, pointer } = setup();
      state.pixel = [0, 0, 7];

      pointer("pointermove", 10, 10);
      pointer("pointermove", 20, 20);
      pointer("pointermove", 30, 30);
      expect(hovers).toEqual([]); // nothing until the frame fires

      runFrame();

      expect(hovers).toEqual([[7]]);
      expect(state.renderCount).toBe(1);
      expect(state.scissors).toEqual([{ x: 30, y: 569, w: 1, h: 1 }]);
    });

    it("reports an empty hover for a miss", () => {
      const { hovers, pointer } = setup();

      pointer("pointermove", 10, 10);
      runFrame();

      expect(hovers).toEqual([[]]);
    });

    it("is suppressed while a button is pressed (including touch contact)", () => {
      const { state, hovers, pointer } = setup();

      pointer("pointermove", 10, 10, { buttons: 1 });
      pointer("pointermove", 10, 10, { buttons: 1, pointerType: "touch" });
      runFrame();

      expect(hovers).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("re-checks the listener gate when the frame fires", () => {
      const { state, hovers, gates, pointer } = setup();
      state.pixel = [0, 0, 7];

      pointer("pointermove", 10, 10);
      // Listeners are removed between the pointermove and the frame.
      gates.hoverable = false;
      runFrame();

      expect(hovers).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("schedules nothing when no hover listener is registered", () => {
      const { state, hovers, pointer } = setup({ hoverable: false });

      pointer("pointermove", 10, 10);

      expect(rafCallbacks.size).toBe(0);
      runFrame();
      expect(hovers).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("pointerleave reports nothing hovered and cancels the pending pick", () => {
      const { state, hovers, pointer } = setup();
      state.pixel = [0, 0, 7];

      pointer("pointermove", 10, 10);
      pointer("pointerleave", 10, 10);

      expect(hovers).toEqual([[]]);

      runFrame();
      // The queued pick was cancelled: no render, no second callback.
      expect(hovers).toEqual([[]]);
      expect(state.renderCount).toBe(0);
    });

    it("pointerleave stays silent without hover listeners", () => {
      const { hovers, pointer } = setup({ hoverable: false });

      pointer("pointerleave", 10, 10);

      expect(hovers).toEqual([]);
    });
  });

  describe("enablePick(false)", () => {
    it("detaches every handler and cancels pending hover picks", () => {
      const { helper, state, picks, hovers, pointer } = setup();
      state.pixel = [0, 0, 7];
      pointer("pointermove", 10, 10);

      helper.enablePick(false);

      expect(rafCallbacks.size).toBe(0);
      pointer("pointerdown", 100, 100);
      pointer("pointerup", 100, 100);
      pointer("pointermove", 20, 20);
      runFrame();

      expect(picks).toEqual([]);
      expect(hovers).toEqual([]);
      expect(state.renderCount).toBe(0);
    });
  });
});
