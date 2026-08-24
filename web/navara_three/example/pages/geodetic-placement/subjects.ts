import { Color } from "@navaramap/three";
import type ThreeView from "@navaramap/three";
import type { MeshConfig } from "@navaramap/three";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";

/**
 * Every descriptor config `view.addMesh` accepts for this page's descriptor
 * set. Derived from the method rather than re-listed, so a new built-in
 * descriptor never needs a matching edit here.
 */
export type MeshConfigInput = Parameters<
  ThreeView<DefaultDescriptions>["addMesh"]
>[0];

/**
 * The transform half of a descriptor config. Each subject is created twice —
 * once with `geodetic`, once with the pre-geodetic `matrixWorld` + local TRS —
 * so the transform is passed in and the description stays shared.
 */
export type Transform = Pick<
  MeshConfig,
  "geodetic" | "matrixWorld" | "position" | "rotation" | "scale"
>;

/**
 * One descriptor under test.
 *
 * `config` is a function rather than a plain object so its body is a single
 * concrete descriptor literal: spreading a transform into a value typed as the
 * whole `MeshConfigInput` union would leave TypeScript unable to pick a member.
 */
export type Subject = {
  /** Registered descriptor key — also the label in the focus dropdown. */
  key: string;
  /**
   * Which code path resolves `geodetic` for this descriptor. `rte` descriptors
   * override the base class's world-matrix slot with their own
   * relative-to-eye position split, so they re-derive the frame instead of
   * inheriting it; `base` descriptors use `MeshDesc.applyTransform` as-is.
   */
  path: "rte" | "base";
  /** Metres to raise the mesh inside its frame so it rests on the ground. */
  lift: number;
  /**
   * Whether the descriptor's update type carries transform fields.
   * `AxesHelperUpdate` / `ArrowHelperUpdate` are
   * `Pick<MeshConfig, "position" | "visible">`, so those two accept `geodetic`
   * at construction but cannot be re-placed by the pane.
   */
  placementUpdatable: boolean;
  config: (t: Transform) => MeshConfigInput;
};

const ACCENT = new Color().setStyle("#0091ff");
const ACCENT_ALT = new Color().setStyle("#ff6b2c");

/**
 * A 2x2 instance block inside the parent frame. `geodetic` builds a
 * West-Up-North frame, so +X is west, +Y up and +Z north; the pre-geodetic
 * `northUpEastToFixedFrame` used for the legacy column is +X north, +Y up,
 * +Z east. The block is symmetric in X/Z so it reads the same in both.
 */
const BLOCK = [-6, 6].flatMap((x) => [-6, 6].map((z) => ({ x, y: 0, z })));

export const SUBJECTS: Subject[] = [
  {
    key: "box",
    path: "base",
    lift: 4,
    placementUpdatable: true,
    config: (t) => ({
      ...t,
      box: { width: 8, height: 8, depth: 8, color: ACCENT },
    }),
  },
  {
    key: "sphere",
    path: "base",
    lift: 4,
    placementUpdatable: true,
    config: (t) => ({ ...t, sphere: { radius: 4, color: ACCENT } }),
  },
  {
    key: "cylinder",
    path: "base",
    lift: 4,
    placementUpdatable: true,
    config: (t) => ({
      ...t,
      cylinder: { radiusTop: 3, radiusBottom: 3, height: 8, color: ACCENT },
    }),
  },
  {
    // PlaneGeometry lies in the local XY plane, so in a Y-up frame the plane
    // stands upright and its face points along +Z — a free heading readout.
    key: "plane",
    path: "base",
    lift: 5,
    placementUpdatable: true,
    config: (t) => ({ ...t, plane: { width: 10, height: 10, color: ACCENT } }),
  },
  {
    // `points` are local to the frame, not geographic, so the tube is
    // geodetically placeable (unlike arcLines / smoothLines).
    key: "tube",
    path: "base",
    lift: 0,
    placementUpdatable: true,
    config: (t) => ({
      ...t,
      tube: {
        points: [
          { x: -5, y: 0, z: 0 },
          { x: 0, y: 8, z: 0 },
          { x: 5, y: 0, z: 0 },
        ],
        radius: 1,
        color: ACCENT,
      },
    }),
  },
  {
    // The frame readout: red/green/blue = local X/Y/Z, so a wrong basis or a
    // mis-signed heading is visible without reading numbers.
    key: "axesHelper",
    path: "base",
    lift: 10,
    placementUpdatable: false,
    config: (t) => ({ ...t, axesHelper: { size: 20 } }),
  },
  {
    key: "arrowHelper",
    path: "base",
    lift: 0,
    placementUpdatable: false,
    config: (t) => ({
      ...t,
      arrowHelper: { direction: { x: 0, y: 0, z: 1 }, length: 20 },
    }),
  },
  {
    key: "boxes",
    path: "base",
    lift: 3,
    placementUpdatable: true,
    config: (t) => ({
      ...t,
      boxes: {
        color: ACCENT_ALT,
        children: BLOCK.map((position) => ({
          position,
          width: 5,
          height: 6,
          depth: 5,
        })),
      },
    }),
  },
  {
    key: "spheres",
    path: "base",
    lift: 3,
    placementUpdatable: true,
    config: (t) => ({
      ...t,
      spheres: {
        color: ACCENT_ALT,
        children: BLOCK.map((position) => ({ position, radius: 3 })),
      },
    }),
  },
  {
    key: "cylinders",
    path: "base",
    lift: 3,
    placementUpdatable: true,
    config: (t) => ({
      ...t,
      cylinders: {
        color: ACCENT_ALT,
        children: BLOCK.map((position) => ({
          position,
          radius: 2,
          height: 6,
        })),
      },
    }),
  },
  {
    key: "planes",
    path: "base",
    lift: 4,
    placementUpdatable: true,
    config: (t) => ({
      ...t,
      planes: {
        color: ACCENT_ALT,
        children: BLOCK.map((position) => ({
          position,
          width: 7,
          height: 7,
        })),
      },
    }),
  },
  {
    // A West-Up-North frame matches glTF's own front=+Z / up=+Y convention, so
    // the car needs no up-axis correction under `geodetic`.
    key: "gltfModel",
    path: "rte",
    lift: 0,
    placementUpdatable: true,
    config: (t) => ({ ...t, gltfModel: { url: "/glTF/car/scene.gltf" } }),
  },
  {
    key: "gltfModels",
    path: "rte",
    lift: 0,
    placementUpdatable: true,
    config: (t) => ({
      ...t,
      gltfModels: {
        url: "/glTF/Lantern/Lantern.glb",
        emissiveColor: new Color().setStyle("#ffcc66"),
        emissiveIntensity: 3,
        children: BLOCK.map((position) => ({
          position,
          scale: { x: 1.5, y: 1.5, z: 1.5 },
        })),
      },
    }),
  },
];
