/**
 * Custom mesh layer with explicit picking opt-in.
 *
 * Shows the pattern for building a user-authored mesh layer that supports
 * GPU picking. Picking is NOT automatic — the subclass decides whether to
 * construct a `PickableMeshWrapper` in `createMesh`, registers it with the
 * ViewContext, and exposes the assigned `batchId` for consumers to correlate
 * pick events back to the layer.
 *
 * If you have a custom ShaderMaterial and do not want Navara to inject
 * picking code into your shader, implement `PickableMesh` directly instead
 * of using `PickableMeshWrapper` — see its jsdoc for the contract.
 */
import ThreeView, {
  Color,
  MeshLayerDeclaration,
  PickableMeshWrapper,
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import {
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  TorusKnotGeometry,
  Vector3,
} from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { TILE_DATASETS } from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

// ============================================================================
// TorusKnotMeshLayer — a custom mesh layer with picking support.
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
    castShadow?: boolean;
    receiveShadow?: boolean;
  };
};

/**
 * Note that `pickable` lives on the layer's own config — the framework's
 * `MeshLayerConfig` no longer carries it. Each custom layer decides on its
 * own whether to expose a picking opt-in.
 */
type TorusKnotLayerConfig = MeshLayerConfig &
  TorusKnotDescription & { pickable?: boolean };

type TorusKnotLayerUpdate = MeshLayerUpdate & TorusKnotDescription;

class TorusKnotMeshLayer extends MeshLayerDeclaration<
  TorusKnotLayerConfig,
  TorusKnotLayerUpdate,
  Mesh<TorusKnotGeometry, MeshStandardMaterial>
> {
  private cfg: TorusKnotLayerConfig;
  private pickWrapper?: PickableMeshWrapper;

  constructor(view: ThreeView, ctx: ViewContext, config: TorusKnotLayerConfig) {
    super(view, ctx, config);
    this.cfg = config;
  }

  /** Exposed so consumers can match pick events to this layer. */
  get batchId(): number | undefined {
    return this.pickWrapper?.batchId;
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
    const material = new MeshStandardMaterial({
      color: k.color?.raw ?? 0xffffff,
      metalness: 0.2,
      roughness: 0.5,
    });
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = k.castShadow ?? true;
    mesh.receiveShadow = k.receiveShadow ?? true;
    this.ctx.applyShadowMaterial(material);

    // ── Picking opt-in: user constructs the wrapper explicitly. ──
    if (this.cfg.pickable) {
      this.pickWrapper = new PickableMeshWrapper(mesh, this.ctx);
      this.ctx.registerPickableMesh(this.id, this.pickWrapper);
    }

    return mesh;
  }

  onUpdateConfig(updates: TorusKnotLayerUpdate): void {
    if (updates.torusKnot?.color !== undefined && this._instance) {
      this._instance.material.color.set(updates.torusKnot.color.raw);
      this.emit("needsUpdate");
    }
    super.onUpdateConfig(updates);
  }

  override onDestroy(): void {
    if (this.pickWrapper) {
      this.ctx.unregisterPickableMesh(this.id);
      this.pickWrapper = undefined;
    }
    if (this._instance) {
      this.ctx.removeShadowMaterial(this._instance.material);
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
  const view = new ThreeView<TorusKnotLayerConfig | DefaultLayerDescriptions>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  await view.init();

  defaultPlugin.addDefaultPhotorealLayers();
  view.atmosphere.date.setHours(10);

  // Register the custom layer by type key.
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

  // Place a row of knots above Tokyo Station.
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

  // Track knots so we can highlight/restore on pick events.
  const knots = KNOT_COLORS.map((hex, i) => {
    const x = (i - (KNOT_COLORS.length - 1) / 2) * SPACING;
    const local = new Matrix4()
      .makeTranslation(x, Y, 0)
      .scale(new Vector3(SCALE, SCALE, SCALE));
    const matrixWorld = nueFrame.clone().multiply(local);

    const layer = view.addLayer<TorusKnotMeshLayer>({
      type: "mesh",
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

  // ── Pick UI ──
  const pane = new Pane({ title: "Custom Pickable Layer" });
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
    // Restore previous selection.
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
