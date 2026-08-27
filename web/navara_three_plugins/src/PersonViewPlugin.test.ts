import { Matrix4, Vector3 } from "three";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { PersonViewPlugin, type CollisionConfig } from "./PersonViewPlugin";

// Importing the real @navaramap/three touches WASM/os at module load, which
// fails in the test environment. The geodetic helpers the plugin calls are
// stubbed with a spherical-earth model: it shares the conventions the plugin
// relies on (ENU columns are east / north / up, heading 0 = north) which is
// what these tests exercise, without pulling in the ellipsoid math.
const R = 6378137;
const DEG = Math.PI / 180;

/* eslint-disable @typescript-eslint/no-extraneous-class */
vi.mock("@navaramap/three", () => ({
  default: class ThreeView {},
  Plugin: class Plugin {},
  MeshHandle: class MeshHandle {},
  degreeToRadian: (deg: number) => (deg * Math.PI) / 180,
  radianToDegree: (rad: number) => (rad * 180) / Math.PI,
  // Lat/lng cross this boundary in degrees, like the real helpers.
  geodeticToVector3: ({
    lat,
    lng,
    height,
  }: {
    lat: number;
    lng: number;
    height: number;
  }) =>
    new Vector3(
      (R + height) * Math.cos(lat * DEG) * Math.cos(lng * DEG),
      (R + height) * Math.cos(lat * DEG) * Math.sin(lng * DEG),
      (R + height) * Math.sin(lat * DEG),
    ),
  vector3ToGeodetic: (v: Vector3) => {
    const radius = v.length();
    return {
      lat: Math.asin(v.z / radius) / DEG,
      lng: Math.atan2(v.y, v.x) / DEG,
      height: radius - R,
    };
  },
  eastNorthUpToFixedFrame: (pos: Vector3) => {
    const radius = pos.length();
    const lat = Math.asin(pos.z / radius);
    const lng = Math.atan2(pos.y, pos.x);
    const east = new Vector3(-Math.sin(lng), Math.cos(lng), 0);
    const north = new Vector3(
      -Math.sin(lat) * Math.cos(lng),
      -Math.sin(lat) * Math.sin(lng),
      Math.cos(lat),
    );
    const up = new Vector3(
      Math.cos(lat) * Math.cos(lng),
      Math.cos(lat) * Math.sin(lng),
      Math.sin(lat),
    );
    return new Matrix4().makeBasis(east, north, up).setPosition(pos);
  },
}));
/* eslint-enable @typescript-eslint/no-extraneous-class */

const START = { lat: 36.25, lng: 137.64 };

/** Terrain rising toward the north at the given grade. */
const northSlope =
  (grade: number): TerrainFn =>
  (lat) =>
    (lat - START.lat) * DEG * R * grade;

/** Terrain height in meters, from a position in degrees. */
type TerrainFn = (lat: number, lng: number) => number | undefined;

const makeFakeView = (
  terrain: TerrainFn,
  mostDetailed: TerrainFn = terrain,
) => {
  const loadListeners: (() => void)[] = [];
  const placements: {
    targetHeight: number;
    offsetZ: number;
    offsetHorizontal: number;
  }[] = [];
  const position = new Vector3();
  const ref = {
    on: (event: string, cb: () => void) => {
      if (event === "load") loadListeners.push(cb);
    },
    getWorldPosition: () => position.clone(),
    setAnimationSpeed: vi.fn(),
    crossFadeAnimation: vi.fn(),
  };
  const handle = {
    ref,
    visible: true,
    update: vi.fn((desc: { matrixWorld?: Matrix4 }) => {
      if (desc.matrixWorld) position.setFromMatrixPosition(desc.matrixWorld);
    }),
    delete: vi.fn(),
  };
  return {
    addMesh: vi.fn((desc: { matrixWorld?: Matrix4 }) => {
      if (desc.matrixWorld) position.setFromMatrixPosition(desc.matrixWorld);
      return handle;
    }),
    sampleTerrainHeight: vi.fn(({ lat, lng }: { lat: number; lng: number }) =>
      terrain(lat, lng),
    ),
    sampleTerrainMostDetailed: vi.fn(
      (_source: unknown, positions: { lat: number; lng: number }[]) =>
        Promise.resolve(
          positions.map(({ lat, lng }) => ({
            lat,
            lng,
            height: mostDetailed(lat, lng),
          })),
        ),
    ),
    // The plugin passes a reused scratch Vector3 as the offset, so snapshot
    // each placement instead of holding on to the object.
    placements,
    cameraFollow: vi.fn(
      (
        _enabled: boolean,
        target?: { height: number },
        offset?: { x: number; y: number; z: number },
      ) => {
        if (target && offset)
          placements.push({
            targetHeight: target.height,
            offsetZ: offset.z,
            offsetHorizontal: Math.hypot(offset.x, offset.y),
          });
      },
    ),
    cameraFreeLook: vi.fn(),
    handle,
    /** Fire the model's "load" event, which starts the per-frame loop. */
    finishModelLoad: () => loadListeners.forEach((cb) => cb()),
  };
};

type FakeView = ReturnType<typeof makeFakeView>;

/** Plugins to dispose after the running test, however it ends. */
const active: PersonViewPlugin[] = [];

const initPlugin = async (plugin: PersonViewPlugin, view: FakeView) => {
  // The fake view only implements the members the plugin touches.
  await plugin.init(view as never, {} as never);
  active.push(plugin);
};

/** The character world matrix written by the most recent frame. */
const lastCharacterFrame = (view: FakeView): Matrix4 => {
  const matrix = view.handle.update.mock.lastCall?.[0].matrixWorld;
  if (!matrix) throw new Error("no character frame was written");
  return matrix;
};

describe("PersonViewPlugin terrain collision", () => {
  const frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    frames.length = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    for (const plugin of active) plugin.dispose();
    active.length = 0;
    vi.unstubAllGlobals();
  });

  /** Run the pending frame callback at `time` ms. */
  const advance = (time: number) => {
    const cb = frames.pop();
    if (!cb) throw new Error("no frame scheduled");
    cb(time);
  };

  describe("teleport", () => {
    it("keeps the requested altitude when collision is off", async () => {
      const view = makeFakeView(() => 1500);
      const plugin = new PersonViewPlugin();
      await initPlugin(plugin, view);

      plugin.teleport({ ...START, alt: 800 });

      expect(plugin.getState().alt).toBe(800);
    });

    it("snaps onto the terrain in ground mode", async () => {
      const view = makeFakeView(() => 1500);
      const plugin = new PersonViewPlugin({
        // Settling must not delay a teleport — it is meant to be instant.
        collision: { mode: "ground", groundOffset: 2 },
      });
      await initPlugin(plugin, view);

      plugin.teleport({ ...START, alt: 800 });

      expect(plugin.getState().alt).toBe(1502);
    });

    it("only lifts up to the terrain floor in clamp mode", async () => {
      const view = makeFakeView(() => 1500);
      const plugin = new PersonViewPlugin({ collision: { mode: "clamp" } });
      await initPlugin(plugin, view);

      plugin.teleport({ ...START, alt: 800 });
      expect(plugin.getState().alt).toBe(1500);

      plugin.teleport({ ...START, alt: 2000 });
      expect(plugin.getState().alt).toBe(2000);
    });

    it("keeps the requested altitude while terrain is unloaded", async () => {
      const view = makeFakeView(() => undefined);
      const plugin = new PersonViewPlugin({ collision: { mode: "ground" } });
      await initPlugin(plugin, view);

      plugin.teleport({ ...START, alt: 800 });

      expect(plugin.getState().alt).toBe(800);
    });
  });

  describe("resolveStartHeight", () => {
    it("pins the start height to the most detailed terrain sample", async () => {
      const view = makeFakeView(() => 1500);
      const plugin = new PersonViewPlugin({
        startLat: START.lat,
        startLng: START.lng,
        startHeight: 800,
      });
      await initPlugin(plugin, view);

      await expect(plugin.resolveStartHeight("terrain")).resolves.toBe(1500);

      // The sampler takes degrees, matching `ThreeView.sampleTerrainMostDetailed`.
      const [, positions] = view.sampleTerrainMostDetailed.mock.calls[0];
      expect(positions[0].lat).toBeCloseTo(START.lat);
      expect(positions[0].lng).toBeCloseTo(START.lng);
      expect(plugin.getState().alt).toBe(1500);
    });

    it("includes the collision's groundOffset like the collision itself", async () => {
      const view = makeFakeView(() => 1500);
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground", groundOffset: 2 },
      });
      await initPlugin(plugin, view);

      await expect(plugin.resolveStartHeight("terrain")).resolves.toBe(1502);
      expect(plugin.getState().alt).toBe(1502);
    });

    it("keeps the configured height when the source has no data there", async () => {
      const view = makeFakeView(() => undefined);
      const plugin = new PersonViewPlugin({ startHeight: 800 });
      await initPlugin(plugin, view);

      await expect(plugin.resolveStartHeight("terrain")).resolves.toBe(
        undefined,
      );
      expect(plugin.getState().alt).toBe(800);
    });

    it("holds the resolved height against coarser tiles until movement", async () => {
      // Render-resident tiles report 1000m while the most detailed data
      // says 1500m — the situation right after load.
      const view = makeFakeView(
        () => 1000,
        () => 1500,
      );
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground" },
        startLat: START.lat,
        startLng: START.lng,
      });
      await initPlugin(plugin, view);
      await plugin.resolveStartHeight("terrain");

      plugin.start();
      let time = performance.now();
      for (let i = 0; i < 100; i++) advance((time += 100));
      expect(plugin.getState().alt).toBeCloseTo(1500, 6);

      // The first movement input hands the altitude over to the collision,
      // which settles onto the render-resident surface.
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
      for (let i = 0; i < 200; i++) advance((time += 100));
      expect(plugin.getState().alt).toBeCloseTo(1000, 6);
    });

    it("releases the pinned height on teleport", async () => {
      const view = makeFakeView(
        () => 1000,
        () => 1500,
      );
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground" },
        startLat: START.lat,
        startLng: START.lng,
      });
      await initPlugin(plugin, view);
      await plugin.resolveStartHeight("terrain");

      plugin.start();
      plugin.teleport({ ...START, alt: 800 });
      let time = performance.now();
      for (let i = 0; i < 5; i++) advance((time += 100));

      expect(plugin.getState().alt).toBeCloseTo(1000, 6);
    });
  });

  describe("per-frame follow", () => {
    it("glues the altitude to the terrain in ground mode", async () => {
      const view = makeFakeView(() => 1500);
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground" },
        startLat: START.lat,
        startLng: START.lng,
        startHeight: 1495,
      });
      await initPlugin(plugin, view);

      plugin.start();
      // Long enough for the 5m the character starts off the surface by to be
      // settled through at the plugin's own settle speed.
      let time = performance.now();
      for (let i = 0; i < 100; i++) advance((time += 16));

      expect(plugin.getState().alt).toBeCloseTo(1500, 6);
    });

    it("settles down onto the terrain at a bounded speed", async () => {
      const view = makeFakeView(() => 0);
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground" },
        startLat: START.lat,
        startLng: START.lng,
        startHeight: 1000,
      });
      await initPlugin(plugin, view);

      plugin.start();
      // 0.1s is the plugin's delta clamp, so the drop is covered at the settle
      // speed — a fraction of a meter — however far off the surface turned out
      // to be.
      advance(performance.now() + 100);

      const covered = 1000 - plugin.getState().alt;
      expect(covered).toBeGreaterThan(0);
      expect(covered).toBeLessThan(2);
    });

    it("tracks a slope it walks onto without settling", async () => {
      // Settling is for the terrain data changing, never for ground the
      // character walks onto: lagging behind a climb would leave it — and the
      // chase camera behind it — inside the hillside.
      const grade = 0.5;
      const view = makeFakeView(northSlope(grade));
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground" },
        startLat: START.lat,
        startLng: START.lng,
        startHeight: 0,
        startHeading: 0, // north, straight up the slope
        moveSpeed: 50,
      });
      await initPlugin(plugin, view);

      plugin.start();
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
      const start = performance.now();
      for (let i = 1; i <= 10; i++) advance(start + i * 16);

      const state = plugin.getState();
      const climbed = ((state.lat - START.lat) * Math.PI) / 180;
      expect(climbed).toBeGreaterThan(0);
      expect(state.alt).toBeCloseTo(climbed * R * grade, 3);
    });

    it("works off a terrain data shift at a pace of its own", async () => {
      // A finer LOD tile replacing a coarse one moves the surface without the
      // character having moved at all — often by hundreds of meters right after
      // load. Following that in one frame is a teleport, so it is worked off at
      // a pace that does not depend on how far off the data was.
      const run = async (shiftTo: number, frames: number) => {
        let terrain = 1000;
        const view = makeFakeView(() => terrain);
        const plugin = new PersonViewPlugin({
          collision: { mode: "ground" },
          startLat: START.lat,
          startLng: START.lng,
          startHeight: 1000,
        });
        await initPlugin(plugin, view);

        plugin.start();
        let time = performance.now();
        advance((time += 16));
        expect(plugin.getState().alt).toBeCloseTo(1000, 6);

        terrain = shiftTo;
        for (let i = 0; i < frames; i++) advance((time += 16));
        return plugin.getState().alt - 1000;
      };

      // 50m out and 4000m out are covered identically — the character is not
      // thrown across the difference.
      expect(await run(1050, 10)).toBeCloseTo(await run(5000, 10), 6);

      // The pace builds up, so a correction that stays finishes in seconds
      // rather than crawling in at a fixed speed for half a minute.
      expect(await run(1200, 500)).toBeCloseTo(200, 6);

      // Ground dropping away is worked off exactly the same way.
      expect(await run(800, 500)).toBeCloseTo(-200, 6);
    });

    it("ignores the ascend key in ground mode", async () => {
      const view = makeFakeView(() => 1500);
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground" },
        startHeight: 1500,
        altSpeed: 100,
      });
      await initPlugin(plugin, view);

      plugin.start();
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      advance(performance.now() + 100);

      expect(plugin.getState().alt).toBeCloseTo(1500, 6);
    });
  });

  describe("alignToSlope", () => {
    const character = {
      modelUrl: "/model.glb",
      animation: { idleClip: "Idle", dashClip: "Run", crossfadeDuration: 0.3 },
    };

    /**
     * How far the character's own axes are lifted off the horizontal:
     * `sin(pitch)` forward and `-sin(roll)` sideways, so a slope of `grade`
     * settles at `sin(atan(grade))` on whichever axis faces uphill.
     */
    const tilt = (view: FakeView): { forward: number; right: number } => {
      const frame = lastCharacterFrame(view);
      const up = new Vector3().setFromMatrixPosition(frame).normalize();
      return {
        forward: new Vector3().setFromMatrixColumn(frame, 1).dot(up),
        right: new Vector3().setFromMatrixColumn(frame, 0).dot(up),
      };
    };

    /** A started plugin with its model loaded, standing on `terrain`. */
    const walkOn = async (
      terrain: TerrainFn,
      collision: CollisionConfig,
      startHeading = 0,
    ) => {
      const view = makeFakeView(terrain);
      const plugin = new PersonViewPlugin({
        character,
        collision: { mode: "ground", alignToSlope: true, ...collision },
        startLat: START.lat,
        startLng: START.lng,
        startHeight: 0,
        startHeading,
      });
      await initPlugin(plugin, view);
      plugin.start();
      view.finishModelLoad();
      return { view, plugin };
    };

    /** Run frames until the eased tilt has settled on the terrain. */
    const settleTilt = () => {
      let time = performance.now();
      for (let i = 0; i < 200; i++) advance((time += 16));
    };

    it("keeps the tilt alive while the start height is pinned", async () => {
      const grade = 0.5;
      const view = makeFakeView(northSlope(grade));
      const plugin = new PersonViewPlugin({
        character,
        collision: { mode: "ground", alignToSlope: true },
        startLat: START.lat,
        startLng: START.lng,
        startHeading: 0,
      });
      await initPlugin(plugin, view);
      // Pinning must not read as airborne: the slope tilt still applies.
      await plugin.resolveStartHeight("terrain");
      plugin.start();
      view.finishModelLoad();

      settleTilt();

      expect(tilt(view).forward).toBeCloseTo(Math.sin(Math.atan(grade)), 3);
    });

    it("pitches the character nose-up when it faces uphill", async () => {
      const grade = 0.5;
      const { view } = await walkOn(northSlope(grade), {}, 0);

      settleTilt();

      // Forward is lifted off the horizontal by the slope angle...
      expect(tilt(view).forward).toBeCloseTo(Math.sin(Math.atan(grade)), 3);
      // ...while the sideways axis stays level: the slope has no cross fall.
      expect(tilt(view).right).toBeCloseTo(0, 6);
    });

    it("rolls the character onto a slope that falls away sideways", async () => {
      const grade = 0.5;
      // Facing east, so the slope rises to the left.
      const { view } = await walkOn(northSlope(grade), {}, 90);

      settleTilt();

      expect(tilt(view).forward).toBeCloseTo(0, 6);
      // Uphill is to the left, so the right-hand side dips below the horizontal.
      expect(tilt(view).right).toBeCloseTo(-Math.sin(Math.atan(grade)), 3);
    });

    it("eases onto a slope that steps under the character", async () => {
      // Terrain that turns from flat to steep between two frames, the way a
      // finer LOD tile replacing a coarse one does.
      let grade = 0;
      const { view } = await walkOn((lat) => northSlope(grade)(lat, 0), {});

      let time = performance.now();
      advance((time += 16));
      expect(tilt(view).forward).toBeCloseTo(0, 6);

      grade = 0.5;
      advance((time += 16));
      const settled = Math.sin(Math.atan(grade));
      // One frame covers a fraction of the step instead of snapping to it.
      const afterStep = tilt(view).forward;
      expect(afterStep).toBeGreaterThan(0);
      expect(afterStep).toBeLessThan(settled * 0.2);

      for (let i = 0; i < 100; i++) advance((time += 16));
      expect(tilt(view).forward).toBeCloseTo(settled, 3);
    });

    it("re-aims the tilt at the new heading the moment it turns", async () => {
      // The smoothed gradient is held relative to north, so turning resolves
      // against it immediately — only the terrain changing is ever eased.
      const grade = 0.5;
      const { view, plugin } = await walkOn(northSlope(grade), {});

      let time = performance.now();
      for (let i = 0; i < 100; i++) advance((time += 16));
      expect(tilt(view).forward).toBeCloseTo(Math.sin(Math.atan(grade)), 3);

      // Face east without advancing a frame: uphill is now to the left.
      plugin.setHeading(90);

      expect(tilt(view).forward).toBeCloseTo(0, 3);
      expect(tilt(view).right).toBeCloseTo(-Math.sin(Math.atan(grade)), 3);
    });

    it("caps the tilt on near-vertical ground", async () => {
      // A 5:1 face is 79°, well past what the character should lie down to.
      const { view } = await walkOn(northSlope(5), {
        maxSlopeTilt: 60,
      });

      settleTilt();

      expect(tilt(view).forward).toBeCloseTo(Math.sin(Math.PI / 3), 3);
    });

    it("keeps the character upright when disabled", async () => {
      const { view } = await walkOn(northSlope(0.5), { alignToSlope: false });

      settleTilt();

      expect(tilt(view).forward).toBeCloseTo(0, 6);
    });

    it("keeps a character flying over the slope upright", async () => {
      // Clamp mode well clear of the ground: there is no slope being stood on,
      // so the model must not lie back with terrain it has left behind.
      const view = makeFakeView(northSlope(0.5));
      const plugin = new PersonViewPlugin({
        character,
        collision: { mode: "clamp", slopeSampleDistance: 4 },
        startLat: START.lat,
        startLng: START.lng,
        startHeight: 100,
      });
      await initPlugin(plugin, view);
      plugin.start();
      view.finishModelLoad();

      settleTilt();

      expect(tilt(view).forward).toBeCloseTo(0, 6);
    });
  });

  describe("chase camera height", () => {
    /** Where the camera eye sits, in meters of altitude. */
    const eyeHeight = (view: FakeView): number => {
      const last = view.placements[view.placements.length - 1];
      if (!last) throw new Error("the camera was never placed");
      return last.targetHeight + last.offsetZ;
    };

    const makePlugin = (terrainFn: TerrainFn, startHeight: number) => {
      const view = makeFakeView(terrainFn);
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground" },
        startLat: START.lat,
        startLng: START.lng,
        startHeight,
        cameraDistance: 20,
        cameraLerpSpeed: 3,
      });
      return { view, plugin };
    };

    it("keeps up with the character while a data step is settled", async () => {
      // A finer LOD tile lands 10m higher under the character: it works that
      // off at the settle speed, and the camera has to ride along with it
      // rather than chase it down over the next second.
      let terrain = 1000;
      const { view, plugin } = makePlugin(() => terrain, 1000);
      await initPlugin(plugin, view);

      plugin.start();
      let time = performance.now();
      for (let i = 0; i < 10; i++) advance((time += 16));
      // How far the eye sits above the character once settled — on level
      // ground, purely the chase pitch.
      const settledLead = eyeHeight(view) - plugin.getState().alt;

      terrain = 1010;
      let worstGap = 0;
      for (let i = 0; i < 200; i++) {
        advance((time += 16));
        const lead = eyeHeight(view) - plugin.getState().alt;
        worstGap = Math.max(worstGap, Math.abs(lead - settledLead));
      }

      // The character glides onto the new surface and the camera glides with
      // it — the settling belongs to the ground, not to the camera.
      expect(plugin.getState().alt).toBeCloseTo(1010, 6);
      expect(worstGap).toBeLessThan(0.1);
    });

    it("keeps the character exactly on the look-at target", async () => {
      let terrain = 1000;
      const { view, plugin } = makePlugin(() => terrain, 1000);
      await initPlugin(plugin, view);

      plugin.start();
      terrain = 1025;
      advance(performance.now() + 16);

      // Smoothing moves the eye, never the aim: the character stays framed.
      const last = view.placements[view.placements.length - 1];
      expect(last.targetHeight).toBe(
        plugin.getState().alt + plugin.getFpvHeightOffset(),
      );
    });

    it("follows a sustained descent without falling behind", async () => {
      // Ground dropping 0.2m per frame — about 12 m/s. Easing the height alone
      // would trail that ramp by speed / cameraLerpSpeed = 4m indefinitely.
      let terrain = 1000;
      const { view, plugin } = makePlugin(() => terrain, 1000);
      await initPlugin(plugin, view);

      plugin.start();
      let time = performance.now();
      for (let i = 0; i < 300; i++) {
        terrain -= 0.2;
        advance((time += 16));
      }

      const trueEye = plugin.getState().alt + plugin.getFpvHeightOffset();
      expect(Math.abs(eyeHeight(view) - trueEye)).toBeLessThan(1);
    });
  });

  describe("camera slope pitch", () => {
    // Config takes degrees; the geometric assertions below work in radians.
    const CAMERA_PITCH_DEG = 6;
    const CAMERA_PITCH = CAMERA_PITCH_DEG * DEG;
    const CAMERA_DISTANCE = 20;

    /** Where the chase camera ended up, as a pitch in radians. */
    const cameraPitch = (view: FakeView): number => {
      const last = view.placements[view.placements.length - 1];
      if (!last) throw new Error("the camera was never placed");
      return Math.atan2(last.offsetZ, last.offsetHorizontal);
    };

    /** A plugin standing on a north-facing slope, settled for a few seconds. */
    const standOn = async (
      grade: number,
      heading: number,
      collision: CollisionConfig = {},
      initialView: "tpv" | "fpv" = "tpv",
    ) => {
      const view = makeFakeView(northSlope(grade));
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground", ...collision },
        startLat: START.lat,
        startLng: START.lng,
        startHeight: 0,
        startHeading: heading,
        initialView,
        cameraDistance: CAMERA_DISTANCE,
        cameraPitch: CAMERA_PITCH_DEG,
        fpvPitch: CAMERA_PITCH_DEG,
        cameraLerpSpeed: 10,
      });
      await initPlugin(plugin, view);
      plugin.start();
      let time = performance.now();
      for (let i = 0; i < 120; i++) advance((time += 16));
      return { view, plugin };
    };

    it("drops down-slope to look up a climb", async () => {
      const grade = 0.7;
      const { view } = await standOn(grade, 0); // facing north, uphill

      // The whole slope is given up, so the camera lies along it: below the
      // character, looking up the hill rather than into it.
      expect(cameraPitch(view)).toBeCloseTo(CAMERA_PITCH - Math.atan(grade), 2);
      expect(cameraPitch(view)).toBeLessThan(0);
    });

    it("rises above the slope on a descent", async () => {
      const grade = 0.7;
      const { view } = await standOn(grade, 180); // facing south, downhill

      expect(cameraPitch(view)).toBeCloseTo(CAMERA_PITCH + Math.atan(grade), 2);
    });

    it("follows only the configured fraction of the slope", async () => {
      const grade = 0.7;
      const { view } = await standOn(grade, 0, { cameraSlopeFollow: 0.5 });

      expect(cameraPitch(view)).toBeCloseTo(
        CAMERA_PITCH - Math.atan(grade) * 0.5,
        2,
      );
    });

    it("keeps the configured pitch when the slope is not followed", async () => {
      const { view } = await standOn(0.7, 0, { cameraSlopeFollow: 0 });

      expect(cameraPitch(view)).toBeCloseTo(CAMERA_PITCH, 6);
    });

    it("caps how far a near-vertical slope may swing it", async () => {
      // A 10:1 face is 84°, far steeper than anything that can be walked, so
      // the swing stops at the plugin's own cap rather than following it.
      const { view } = await standOn(10, 0);

      expect(cameraPitch(view)).toBeCloseTo(CAMERA_PITCH - Math.PI / 4, 2);
    });

    it("tilts the FPV eye line up a climb as well", async () => {
      const grade = 0.7;
      const { view } = await standOn(grade, 0, {}, "fpv");

      // FPV places the eye by aiming at a target far ahead: the same slope is
      // given up there, so the view looks up the hill instead of into it.
      expect(cameraPitch(view)).toBeCloseTo(CAMERA_PITCH - Math.atan(grade), 2);
    });

    it("leaves a character flying well above the slope alone", async () => {
      // Clamp mode with the character a chase distance above the surface: there
      // is no hillside between it and the camera to look up or down.
      const view = makeFakeView(northSlope(0.7));
      const plugin = new PersonViewPlugin({
        collision: { mode: "clamp" },
        startLat: START.lat,
        startLng: START.lng,
        startHeight: CAMERA_DISTANCE * 2,
        startHeading: 0,
        cameraDistance: CAMERA_DISTANCE,
        cameraPitch: CAMERA_PITCH_DEG,
        cameraLerpSpeed: 10,
      });
      await initPlugin(plugin, view);

      plugin.start();
      let time = performance.now();
      for (let i = 0; i < 120; i++) advance((time += 16));

      expect(cameraPitch(view)).toBeCloseTo(CAMERA_PITCH, 6);
    });
  });

  describe("stop", () => {
    const walking = async () => {
      const view = makeFakeView(() => 1000);
      const plugin = new PersonViewPlugin({
        collision: { mode: "ground" },
        startLat: START.lat,
        startLng: START.lng,
        startHeight: 1000,
        moveSpeed: 50,
      });
      await initPlugin(plugin, view);
      plugin.start();
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
      let time = performance.now();
      for (let i = 0; i < 10; i++) advance((time += 16));
      return { view, plugin };
    };

    it("hands the camera back and stops reading the keys", async () => {
      const { view, plugin } = await walking();
      const moved = plugin.getState();

      plugin.stop();

      expect(view.cameraFollow).toHaveBeenLastCalledWith(false);
      expect(view.cameraFreeLook).toHaveBeenLastCalledWith(false);
      expect(plugin.getState().speed).toBe(0);

      // The forward key is still physically held and a frame was already
      // scheduled, but neither drives the character now — and no further frame
      // is scheduled behind it.
      advance(performance.now());
      expect(plugin.getState().lat).toBe(moved.lat);
      expect(frames).toHaveLength(0);
    });

    it("resumes from where it stopped rather than the start position", async () => {
      const { view, plugin } = await walking();
      plugin.stop();
      const stopped = plugin.getState();
      expect(stopped.lat).not.toBe(START.lat);

      plugin.start();
      advance(performance.now() + 16);

      expect(plugin.getState().lat).toBeCloseTo(stopped.lat, 6);
      expect(plugin.getState().alt).toBeCloseTo(stopped.alt, 6);
      // The character is placed once; resuming must not add a second model.
      expect(view.addMesh).not.toHaveBeenCalled();
    });

    it("does not deliver the pause as one enormous frame", async () => {
      const { plugin } = await walking();
      plugin.stop();
      const stopped = plugin.getState();

      // Ten seconds of real time pass while the view drives the camera.
      plugin.start();
      advance(performance.now() + 10_000);

      // Only the delta since resuming counts, not the whole pause: the frame
      // clamp bounds it to a tenth of a second of walking.
      const climbed = Math.abs(plugin.getState().lat - stopped.lat);
      expect(climbed).toBeLessThan((0.1 * 50 * 1.5) / R);
    });

    it("is safe to call when it was never started", async () => {
      const view = makeFakeView(() => 1000);
      const plugin = new PersonViewPlugin();
      await initPlugin(plugin, view);

      expect(() => plugin.stop()).not.toThrow();
      expect(view.cameraFollow).not.toHaveBeenCalled();
    });
  });

  describe("setCollision", () => {
    it("merges into the current settings", async () => {
      const view = makeFakeView(() => 1500);
      const plugin = new PersonViewPlugin({
        collision: { mode: "off", groundOffset: 3 },
      });
      await initPlugin(plugin, view);

      plugin.setCollision({ mode: "ground" });

      expect(plugin.getCollision()).toMatchObject({
        mode: "ground",
        groundOffset: 3,
      });
      plugin.teleport({ ...START, alt: 800 });
      expect(plugin.getState().alt).toBe(1503);
    });
  });
});
