/**
 * Custom mesh layer with manual picking support.
 *
 * Unlike the turnkey `PickableMeshWrapper`, this example shows the
 * lower-level path: the user writes the picking branch into their own
 * fragment shader, and implements `PickableMesh` directly to toggle a
 * uniform. Navara never touches the shader source.
 *
 * Contract for manual picking:
 *   1. Your fragment shader must output `batchId` encoded as a flat RGB
 *      color when a "picking" uniform is active.
 *   2. Implement `PickableMesh` on a small wrapper: flip the uniform in
 *      `onBeforePicking` / `onAfterPicking`, and return the renderable
 *      from `_getRenderable()`.
 *   3. Register the wrapper with `ctx.registerPickableMesh(id, wrapper)`.
 *
 * That's it — no shader injection, no string mutation, no collisions with
 * your own `onBeforeCompile`. The 24-bit `batchId` → RGB encoding must
 * match the decode side in `pickHelper` (high byte = R, mid = G, low = B).
 */
import ThreeView, {
  Color,
  MeshLayerDeclaration,
  PickableMesh,
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
  overrideShaderMaterialForMRT,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import {
  Matrix4,
  Mesh,
  Object3D,
  ShaderMaterial,
  TorusKnotGeometry,
  Vector3,
} from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { TILE_DATASETS } from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

// ============================================================================
// Shaders — the user owns these. The picking branch lives here, not in
// Navara. `uPicking` is flipped on/off by the PickableMesh implementation
// below; while it's on, the fragment emits the encoded `uBatchId`.
// ============================================================================

const vertexShader = /* glsl */ `
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vNormal;

  uniform vec3 uColor;
  uniform float uPicking;
  uniform float uBatchId;

  // Encode a 24-bit integer into an RGB color. Matches the decode in
  // navara's pickHelper: R = high byte, G = mid byte, B = low byte.
  vec3 batchIdToColor(float id) {
    float r = floor(id / 65536.0);
    float g = floor(mod(id / 256.0, 256.0));
    float b = mod(id, 256.0);
    return vec3(r, g, b) / 255.0;
  }

  void main() {
    // Normal-direction lambert for a cheap lit look.
    vec3 lightDir = normalize(vec3(0.4, 1.0, 0.3));
    float lambert = max(dot(vNormal, lightDir), 0.0);
    gl_FragColor = vec4(uColor * (0.3 + 0.7 * lambert), 1.0);

    // Picking override — must come last so it wins over all other writes.
    if (uPicking > 0.5) {
      gl_FragColor = vec4(batchIdToColor(uBatchId), 1.0);
    }
  }
`;

// ============================================================================
// Manual PickableMesh — holds the batchId and flips the shader's uPicking
// uniform around the pick pass. Navara never sees or mutates the shader.
// ============================================================================

class PickableTorusKnot extends Object3D implements PickableMesh {
  public readonly batchId: number;

  constructor(
    public mesh: Mesh<TorusKnotGeometry, ShaderMaterial>,
    ctx: ViewContext,
  ) {
    super();
    this.batchId = ctx.genGlobalBatchId() ?? 0;
    // Bake the batchId into the material once — it's invariant per-mesh.
    mesh.material.uniforms.uBatchId.value = this.batchId;
  }

  onBeforePicking(): void {
    this.mesh.material.uniforms.uPicking.value = 1;
  }

  onAfterPicking(): void {
    this.mesh.material.uniforms.uPicking.value = 0;
  }

  _getRenderable(): Object3D {
    return this.mesh;
  }
}

// ============================================================================
// TorusKnotMeshLayer — a custom mesh layer that uses the manual path.
// ============================================================================

type TorusKnotDescription = {
  torusKnot?: {
    radius?: number;
    tube?: number;
    tubularSegments?: number;
    radialSegments?: number;
    p?: number;
    q?: number;
    color?: Color;
  };
};

type TorusKnotLayerConfig = MeshLayerConfig &
  TorusKnotDescription & { pickable?: boolean };

type TorusKnotLayerUpdate = MeshLayerUpdate & TorusKnotDescription;

type CustomDeclarations =
  | DefaultDeclarations
  | {
      mesh: TorusKnotLayerConfig;
    };

class TorusKnotMeshLayer extends MeshLayerDeclaration<
  TorusKnotLayerConfig,
  TorusKnotLayerUpdate,
  Mesh<TorusKnotGeometry, ShaderMaterial>
> {
  private cfg: TorusKnotLayerConfig;
  private pickable?: PickableTorusKnot;

  constructor(view: ThreeView, ctx: ViewContext, config: TorusKnotLayerConfig) {
    super(view, ctx, config);
    this.cfg = config;
  }

  /** Exposed so consumers can match pick events to this layer. */
  get batchId(): number | undefined {
    return this.pickable?.batchId;
  }

  createMesh() {
    const k = this.cfg.torusKnot ?? {};
    const geometry = new TorusKnotGeometry(
      k.radius ?? 1,
      k.tube ?? 0.4,
      k.tubularSegments ?? 128,
      k.radialSegments ?? 16,
      k.p ?? 2,
      k.q ?? 3,
    );

    const color = (k.color ?? new Color().setStyle("#ffffff")).raw;
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new Vector3(color.r, color.g, color.b) },
        uPicking: { value: 0 },
        uBatchId: { value: 0 },
      },
    });
    // Navara's opaque pass renders into MRT attachments (normal / effectId /
    // emissive G-buffers). Custom ShaderMaterials must opt in so those
    // buffers get written — otherwise the pipeline sees undefined outputs
    // and the geometry fails to render.
    overrideShaderMaterialForMRT(material, "vNormal");

    const mesh = new Mesh(geometry, material);

    return mesh;
  }

  onUpdateConfig(updates: TorusKnotLayerUpdate): void {
    if (updates.torusKnot?.color !== undefined && this._instance) {
      const c = updates.torusKnot.color.raw;
      this._instance.material.uniforms.uColor.value.set(c.r, c.g, c.b);
      this.emit("needsUpdate");
    }
    super.onUpdateConfig(updates);
  }

  override onCreate(): void {
    super.onCreate();
    if (this.cfg.pickable && this._instance) {
      this.pickable = new PickableTorusKnot(this._instance, this.ctx);
      this.ctx.registerPickableMesh(this.id, this.pickable);
    }
  }

  override onDestroy(): void {
    if (this.pickable) {
      this.ctx.unregisterPickableMesh(this.id);
      this.pickable = undefined;
    }
    if (this._instance) {
      this._instance.geometry.dispose();
      this._instance.material.dispose();
    }
    super.onDestroy();
  }
}

// ============================================================================
// Scene setup
// ============================================================================

const run = async () => {
  const view = new ThreeView<CustomDeclarations>({
    debug: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  await view.init();

  defaultPlugin.addDefaultPhotorealLayers();
  view.atmosphere.date.setHours(10);

  view.registerMesh("torusKnot", TorusKnotMeshLayer);

  view.setCamera({
    lng: 139.767125,
    lat: 35.679,
    height: 800,
    heading: 0,
    pitch: -40,
    roll: 0,
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 18 },
  });

  const origin = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.767125),
    height: 0,
  });
  const nueFrame = northUpEastToFixedFrame(origin);

  const KNOT_COLORS = [0xff4466, 0x44ccff, 0x88ff44, 0xffaa22, 0xaa66ff];
  const SPACING = 80;
  const Y = 60;
  const SCALE = 30;

  const knots = KNOT_COLORS.map((hex, i) => {
    const x = (i - (KNOT_COLORS.length - 1) / 2) * SPACING;
    const local = new Matrix4()
      .makeTranslation(x, Y, 0)
      .scale(new Vector3(SCALE, SCALE, SCALE));
    const matrixWorld = nueFrame.clone().multiply(local);

    const layer = view.addMesh<TorusKnotMeshLayer>({
      pickable: true,
      torusKnot: {
        radius: 1,
        tube: 0.35,
        color: new Color().setHex(hex),
      },
      matrixWorld,
    });

    return { layer, origHex: hex, name: `Knot #${i + 1}` };
  });

  const pane = new Pane({ title: "Manual Picking" });
  const info = { name: "(none)", batchId: 0 };
  const folder = pane.addFolder({ title: "Picked" });
  const nameBinding = folder.addBinding(info, "name", {
    readonly: true,
    label: "name",
  });
  const idBinding = folder.addBinding(info, "batchId", {
    readonly: true,
    label: "batchId",
  });
  addDateControl(view, pane);

  const highlight = new Color().setHex(0xffffff);
  let selected: (typeof knots)[number] | null = null;

  view.on("pick", (pickInfo) => {
    if (selected) {
      selected.layer.update({
        torusKnot: { color: new Color().setHex(selected.origHex) },
      });
      selected = null;
    }

    const picked = knots.find((k) => k.layer.ref.batchId === pickInfo?.batchId);
    if (picked) {
      selected = picked;
      picked.layer.update({ torusKnot: { color: highlight } });
      info.name = picked.name;
      info.batchId = picked.layer.ref.batchId ?? 0;
    } else {
      info.name = "(none)";
      info.batchId = 0;
    }
    nameBinding.refresh();
    idBinding.refresh();
  });

  showAttributions([TILE_DATASETS.openstreetmap]);
};

run();
