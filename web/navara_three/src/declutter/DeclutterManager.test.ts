import { PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";

import { DeclutterManager } from "./DeclutterManager";
import type { DeclutterCandidate, DeclutterParticipant } from "./types";

const R = 6378137.0;

/** Camera one earth-radius above (R, 0, 0), looking at the surface. World +Y
 *  maps to screen right and +Z to screen up. */
function makeCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(60, 800 / 600, 1, 1e9);
  camera.position.set(2 * R, 0, 0);
  camera.up.set(0, 0, 1);
  camera.lookAt(R, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

class FakeParticipant implements DeclutterParticipant {
  hidden = new Map<number, boolean>();
  /** How many more stepDeclutterFade calls report an active fade. */
  fadeStepsLeft = 0;
  fadeDeltas: number[] = [];

  constructor(readonly candidates: Omit<DeclutterCandidate, "owner">[]) {}

  collectDeclutterCandidates(out: DeclutterCandidate[]): void {
    for (const c of this.candidates) out.push({ ...c, owner: this });
  }

  applyDeclutter(handle: number, hidden: boolean): void {
    this.hidden.set(handle, hidden);
  }

  stepDeclutterFade(deltaMs: number): boolean {
    this.fadeDeltas.push(deltaMs);
    if (this.fadeStepsLeft <= 0) return false;
    this.fadeStepsLeft--;
    return true;
  }
}

function label(
  partial: Partial<Omit<DeclutterCandidate, "owner">>,
): Omit<DeclutterCandidate, "owner"> {
  return {
    anchorX: R,
    anchorY: 0,
    anchorZ: 0,
    addHeight: 0,
    minX: -10,
    maxX: 10,
    minY: -10,
    maxY: 10,
    sizeInMeters: false,
    priority: 0,
    isShown: false,
    handle: 0,
    ...partial,
  };
}

describe("DeclutterManager", () => {
  it("hides the lower-priority label of an overlapping pair", () => {
    const manager = new DeclutterManager();
    // Same anchor: both project to the same screen box.
    const p = new FakeParticipant([
      label({ handle: 0, priority: 1 }),
      label({ handle: 1, priority: 5 }),
      // ~1e6 m sideways is far outside a 20px box at this distance.
      label({ handle: 2, priority: 0, anchorY: 1e6 }),
    ]);
    manager.register(p);

    expect(manager.update(makeCamera(), 800, 600, 0)).toBe("ran");
    expect(p.hidden.get(1)).toBe(false);
    expect(p.hidden.get(0)).toBe(true);
    expect(p.hidden.get(2)).toBe(false);
  });

  it("resolves equal-priority ties independently of registration order", () => {
    // Overlapping boxes, distinct anchors: the anchor tiebreak must pick the
    // same winner regardless of participant iteration order.
    const a = label({ handle: 0, anchorY: 0 });
    const b = label({ handle: 1, anchorY: 5e4 });

    const run = (first: typeof a, second: typeof b) => {
      const manager = new DeclutterManager();
      const pa = new FakeParticipant([first]);
      const pb = new FakeParticipant([second]);
      manager.register(pa);
      manager.register(pb);
      manager.update(makeCamera(), 800, 600, 0);
      return { pa, pb };
    };

    const forward = run(a, b);
    const reversed = run(b, a);

    expect(forward.pa.hidden.get(0)).toBe(false);
    expect(forward.pb.hidden.get(1)).toBe(true);
    expect(reversed.pb.hidden.get(0)).toBe(false);
    expect(reversed.pa.hidden.get(1)).toBe(true);
  });

  it("incumbents win equal-priority ties over anchor-favored challengers", () => {
    // Overlapping boxes, equal priority. The anchor tiebreak alone would pick
    // `challenger` (smaller anchorY) — but `incumbent` is currently shown, so
    // hysteresis must keep it shown and hide the challenger.
    const challenger = label({ handle: 0, anchorY: 0, isShown: false });
    const incumbent = label({ handle: 1, anchorY: 5e4, isShown: true });

    const manager = new DeclutterManager();
    const p = new FakeParticipant([challenger, incumbent]);
    manager.register(p);
    manager.update(makeCamera(), 800, 600, 0);

    expect(p.hidden.get(1)).toBe(false);
    expect(p.hidden.get(0)).toBe(true);
  });

  it("never hides horizon-culled or behind-camera labels, and they claim no space", () => {
    const manager = new DeclutterManager();
    const p = new FakeParticipant([
      // Far side of the globe: GPU horizon culling hides it already.
      label({ handle: 0, priority: 10, anchorX: -R }),
      label({ handle: 1, priority: 0 }),
    ]);
    manager.register(p);
    manager.update(makeCamera(), 800, 600, 0);

    expect(p.hidden.get(0)).toBe(false);
    // The invisible high-priority label must not have suppressed the visible one.
    expect(p.hidden.get(1)).toBe(false);
  });

  it("throttles re-runs and reports them so the caller can schedule a frame", () => {
    const manager = new DeclutterManager();
    const p = new FakeParticipant([label({ handle: 0 })]);
    manager.register(p);
    const camera = makeCamera();

    expect(manager.update(camera, 800, 600, 0)).toBe("ran");
    expect(manager.update(camera, 800, 600, 50)).toBe("idle");

    manager.markDirty();
    expect(manager.update(camera, 800, 600, 50)).toBe("throttled");
    expect(
      manager.update(camera, 800, 600, DeclutterManager.MIN_INTERVAL_MS),
    ).toBe("ran");
  });

  it("re-runs when the camera moves and stays idle when nothing changed", () => {
    const manager = new DeclutterManager();
    const p = new FakeParticipant([label({ handle: 0 })]);
    manager.register(p);
    const camera = makeCamera();

    expect(manager.update(camera, 800, 600, 0)).toBe("ran");
    expect(manager.update(camera, 800, 600, 1000)).toBe("idle");

    camera.position.z += 1000;
    camera.updateMatrixWorld(true);
    expect(manager.update(camera, 800, 600, 2000)).toBe("ran");

    // A viewport resize also invalidates placement.
    expect(manager.update(camera, 1024, 768, 3000)).toBe("ran");
  });

  it("reports 'animating' while fades are active, then settles", () => {
    const manager = new DeclutterManager();
    const p = new FakeParticipant([label({ handle: 0 })]);
    manager.register(p);
    const camera = makeCamera();

    // The pass that (re)targets labels also starts their fade.
    p.fadeStepsLeft = 2;
    expect(manager.update(camera, 800, 600, 0)).toBe("animating");
    expect(manager.update(camera, 800, 600, 16)).toBe("animating");
    expect(manager.update(camera, 800, 600, 32)).toBe("idle");
  });

  it("clamps fade steps after an idle gap", () => {
    const manager = new DeclutterManager();
    const p = new FakeParticipant([label({ handle: 0 })]);
    manager.register(p);
    const camera = makeCamera();

    manager.update(camera, 800, 600, 0);
    // 10s of engine idle must not advance a new fade by 10s worth.
    manager.update(camera, 800, 600, 10_000);
    for (const delta of p.fadeDeltas) {
      expect(delta).toBeLessThanOrEqual(DeclutterManager.MAX_FADE_STEP_MS);
    }
  });

  it("prefers 'animating' over 'throttled' so pending passes still settle", () => {
    const manager = new DeclutterManager();
    const p = new FakeParticipant([label({ handle: 0 })]);
    manager.register(p);
    const camera = makeCamera();

    expect(manager.update(camera, 800, 600, 0)).toBe("ran");
    manager.markDirty();
    p.fadeStepsLeft = 1;
    // Dirty + inside the throttle window + fading: animating wins because its
    // prompt follow-ups re-enter update, which runs the pass once due.
    expect(manager.update(camera, 800, 600, 50)).toBe("animating");
    expect(
      manager.update(camera, 800, 600, DeclutterManager.MIN_INTERVAL_MS),
    ).toBe("ran");
  });

  it("goes idle when the last participant unregisters", () => {
    const manager = new DeclutterManager();
    const p = new FakeParticipant([label({ handle: 0 })]);
    manager.register(p);
    const camera = makeCamera();
    expect(manager.update(camera, 800, 600, 0)).toBe("ran");

    manager.unregister(p);
    expect(manager.update(camera, 800, 600, 1000)).toBe("idle");
  });
});
