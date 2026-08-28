import { PerspectiveCamera, Vector2, type WebGLRenderer } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MeshCache } from "../type";

import { isClickGesture, PickHelper } from "./pickHelper";

describe("isClickGesture", () => {
  it("accepts a mouseup at the exact mousedown position", () => {
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

    const mouse = (type: string, x: number, y: number, buttons = 0) =>
      element.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, buttons }),
      );
    return { helper, element, state, picks, hovers, gates, mouse };
  };

  describe("click picking", () => {
    it("decodes the batch id from the pick render", () => {
      const { state, picks, mouse } = setup();
      state.pixel = [0, 1, 2]; // (0 << 16) + (1 << 8) + 2

      mouse("mousedown", 100, 100);
      mouse("mouseup", 100, 100);

      expect(picks).toEqual([[258]]);
      expect(state.renderCount).toBe(1);
    });

    it("reports an empty pick for a miss (batch id 0)", () => {
      const { picks, mouse } = setup();

      mouse("mousedown", 100, 100);
      mouse("mouseup", 100, 100);

      expect(picks).toEqual([[]]);
    });

    it("limits GPU work to the clicked pixel via scissor", () => {
      const { state, mouse } = setup();

      mouse("mousedown", 30, 40);
      mouse("mouseup", 30, 40);

      // y is flipped into WebGL space: 600 - 1 - 40.
      expect(state.scissors).toEqual([{ x: 30, y: 559, w: 1, h: 1 }]);
    });

    it("does not pick when the gesture is a drag", () => {
      const { state, picks, mouse } = setup();

      mouse("mousedown", 100, 100);
      mouse("mouseup", 150, 150);

      expect(picks).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("skips the pick render entirely when nobody listens", () => {
      const { state, picks, mouse } = setup({ clickable: false });

      mouse("mousedown", 100, 100);
      mouse("mouseup", 100, 100);

      expect(picks).toEqual([]);
      expect(state.renderCount).toBe(0);
    });
  });

  describe("hover picking", () => {
    it("picks at most once per animation frame, at the latest position", () => {
      const { state, hovers, mouse } = setup();
      state.pixel = [0, 0, 7];

      mouse("mousemove", 10, 10);
      mouse("mousemove", 20, 20);
      mouse("mousemove", 30, 30);
      expect(hovers).toEqual([]); // nothing until the frame fires

      runFrame();

      expect(hovers).toEqual([[7]]);
      expect(state.renderCount).toBe(1);
      expect(state.scissors).toEqual([{ x: 30, y: 569, w: 1, h: 1 }]);
    });

    it("reports an empty hover for a miss", () => {
      const { hovers, mouse } = setup();

      mouse("mousemove", 10, 10);
      runFrame();

      expect(hovers).toEqual([[]]);
    });

    it("is suppressed while a mouse button is pressed", () => {
      const { state, hovers, mouse } = setup();

      mouse("mousemove", 10, 10, 1);
      runFrame();

      expect(hovers).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("re-checks the listener gate when the frame fires", () => {
      const { state, hovers, gates, mouse } = setup();
      state.pixel = [0, 0, 7];

      mouse("mousemove", 10, 10);
      // Listeners are removed between the mousemove and the frame.
      gates.hoverable = false;
      runFrame();

      expect(hovers).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("schedules nothing when no hover listener is registered", () => {
      const { state, hovers, mouse } = setup({ hoverable: false });

      mouse("mousemove", 10, 10);

      expect(rafCallbacks.size).toBe(0);
      runFrame();
      expect(hovers).toEqual([]);
      expect(state.renderCount).toBe(0);
    });

    it("mouseleave reports nothing hovered and cancels the pending pick", () => {
      const { state, hovers, element, mouse } = setup();
      state.pixel = [0, 0, 7];

      mouse("mousemove", 10, 10);
      element.dispatchEvent(new MouseEvent("mouseleave"));

      expect(hovers).toEqual([[]]);

      runFrame();
      // The queued pick was cancelled: no render, no second callback.
      expect(hovers).toEqual([[]]);
      expect(state.renderCount).toBe(0);
    });

    it("mouseleave stays silent without hover listeners", () => {
      const { hovers, element } = setup({ hoverable: false });

      element.dispatchEvent(new MouseEvent("mouseleave"));

      expect(hovers).toEqual([]);
    });
  });

  describe("enablePick(false)", () => {
    it("detaches every handler and cancels pending hover picks", () => {
      const { helper, state, picks, hovers, mouse } = setup();
      state.pixel = [0, 0, 7];
      mouse("mousemove", 10, 10);

      helper.enablePick(false);

      expect(rafCallbacks.size).toBe(0);
      mouse("mousedown", 100, 100);
      mouse("mouseup", 100, 100);
      mouse("mousemove", 20, 20);
      runFrame();

      expect(picks).toEqual([]);
      expect(hovers).toEqual([]);
      expect(state.renderCount).toBe(0);
    });
  });
});
