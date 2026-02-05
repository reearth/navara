import ThreeView, {
  EffectLayerDeclaration,
  Effect,
  type EffectLayerConfig,
  type EffectLayerUpdate,
  type ViewContext,
} from "@navara/three";
import { VignetteEffect, VignetteTechnique } from "postprocessing";
import type { Camera } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
import {
  addHidePaneKeyShortcut,
  addDateControl,
  addCameraControl,
} from "../../helpers/control";

// ============================================================
// Step 1: Create a custom Effect wrapper class
// This wraps the postprocessing VignetteEffect with typed options
// ============================================================

type VignetteOptions = {
  enabled?: boolean;
  /** The vignette technique: "default" or "eskil" */
  technique?: "default" | "eskil";
  /** The vignette offset. Range is [0.0, 1.0]. */
  offset?: number;
  /** The vignette darkness. Range is [0.0, 1.0]. */
  darkness?: number;
};

const DEFAULT_VIGNETTE_OPTIONS: Required<VignetteOptions> = {
  enabled: true,
  technique: "default",
  offset: 0.5,
  darkness: 0.5,
};

const selectTechnique = (
  technique: VignetteOptions["technique"],
): VignetteTechnique => {
  switch (technique) {
    case "eskil":
      return VignetteTechnique.ESKIL;
    default:
      return VignetteTechnique.DEFAULT;
  }
};

class Vignette extends Effect<VignetteEffect, VignetteOptions> {
  constructor(camera: Camera, options?: VignetteOptions) {
    super(
      camera,
      new VignetteEffect({
        technique: selectTechnique(options?.technique),
        offset: options?.offset ?? DEFAULT_VIGNETTE_OPTIONS.offset,
        darkness: options?.darkness ?? DEFAULT_VIGNETTE_OPTIONS.darkness,
      }),
      options,
    );
  }

  protected onMounted(): void {
    if (!this.rawEffect) return;
    this.technique =
      this.options.technique ?? DEFAULT_VIGNETTE_OPTIONS.technique;
    this.offset = this.options.offset ?? DEFAULT_VIGNETTE_OPTIONS.offset;
    this.darkness = this.options.darkness ?? DEFAULT_VIGNETTE_OPTIONS.darkness;
  }

  get technique(): VignetteOptions["technique"] {
    return this.options.technique ?? DEFAULT_VIGNETTE_OPTIONS.technique;
  }

  set technique(v: VignetteOptions["technique"]) {
    if (this.options.technique === v) return;
    this.options.technique = v;
    if (!this.rawEffect) return;
    this.rawEffect.technique = selectTechnique(v);
    this.emit("_needsUpdate");
  }

  get offset(): number {
    return this.options.offset ?? DEFAULT_VIGNETTE_OPTIONS.offset;
  }

  set offset(v: number) {
    if (this.options.offset === v) return;
    this.options.offset = v;
    if (!this.rawEffect) return;
    this.rawEffect.offset = v;
    this.emit("_needsUpdate");
  }

  get darkness(): number {
    return this.options.darkness ?? DEFAULT_VIGNETTE_OPTIONS.darkness;
  }

  set darkness(v: number) {
    if (this.options.darkness === v) return;
    this.options.darkness = v;
    if (!this.rawEffect) return;
    this.rawEffect.darkness = v;
    this.emit("_needsUpdate");
  }
}

// ============================================================
// Step 2: Create a custom EffectLayerDeclaration
// This integrates the effect into Navara's layer system
// ============================================================

type VignetteLayerDescription = {
  vignette?: Omit<VignetteOptions, "enabled">;
};

export type VignetteEffectConfig = VignetteLayerDescription & EffectLayerConfig;

export type VignetteEffectUpdate = VignetteLayerDescription & EffectLayerUpdate;

class VignetteEffectLayer extends EffectLayerDeclaration<
  VignetteEffectConfig,
  VignetteEffectUpdate,
  Vignette
> {
  // Static key identifies this effect type
  static key = "vignette";
  // Insert before these effects (for proper ordering in the render pipeline)
  static insertBefore = ["smaa", "fxaa", "final"];
  // Allow multiple instances of this effect
  static allowDuplication = true;

  private config: VignetteEffectConfig;

  constructor(view: ViewContext, config: VignetteEffectConfig) {
    super(view, config);
    this.config = config;
  }

  // Factory method to create the effect instance
  createPass() {
    const camera = this.view.camera;

    if (!camera) {
      throw new Error("Camera not available for Vignette effect");
    }

    return new Vignette(camera, {
      ...this.config.vignette,
      enabled: this.config.visible ?? true,
    });
  }

  // Handle parameter updates
  onUpdateConfig(updates: VignetteEffectUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.vignette;
    if (!config) return;

    if (config.technique !== undefined) {
      this._instance.technique = config.technique;
    }

    if (config.offset !== undefined) {
      this._instance.offset = config.offset;
    }

    if (config.darkness !== undefined) {
      this._instance.darkness = config.darkness;
    }
  }
}

// ============================================================
// Step 3: Use the custom effect layer in the application
// ============================================================

export const run = async (view: ThreeView<VignetteEffectConfig>) => {
  await view.init();

  // Register the custom effect layer
  view.registerEffect("vignette", VignetteEffectLayer);

  // Add default atmosphere layers
  view.addDefaultEffectLayers();
  const defaultAtmospheres = view.addDefaultAtmosphereLayers();
  defaultAtmospheres.sun.update({
    sun: {
      intensity: 1,
    },
  });

  // Set initial camera position
  view.setCamera({
    lng: 139.7247928634,
    lat: 35.7348824076,
    height: 1663.76,
    heading: -204.5815985024,
    pitch: -8.0000012192,
    roll: 0,
  });

  // Add the custom Vignette effect layer
  const vignetteLayer = view.addLayer<VignetteEffectLayer>({
    type: "effect",
    vignette: {
      technique: "default",
      offset: 0.5,
      darkness: 0.5,
    },
    visible: true,
  });

  // Add base map tiles
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  // Add 3D buildings
  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      metalness: 0.1,
      roughness: 0.5,
    },
  });

  // Create UI controls with tweakpane
  const pane = new Pane({
    title: "Custom Vignette Effect",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  const params = {
    technique: "default" as "default" | "eskil",
    offset: 0.5,
    darkness: 0.5,
    visible: true,
  };

  pane
    .addBinding(params, "visible", { label: "Enabled" })
    .on("change", (ev) => {
      vignetteLayer.update({ visible: ev.value });
    });

  pane
    .addBinding(params, "technique", {
      label: "Technique",
      options: {
        Default: "default",
        Eskil: "eskil",
      },
    })
    .on("change", (ev) => {
      vignetteLayer.update({ vignette: { technique: ev.value } });
    });

  pane
    .addBinding(params, "offset", { min: 0.0, max: 1.0, step: 0.01 })
    .on("change", (ev) => {
      vignetteLayer.update({ vignette: { offset: ev.value } });
    });

  pane
    .addBinding(params, "darkness", { min: 0.0, max: 1.0, step: 0.01 })
    .on("change", (ev) => {
      vignetteLayer.update({ vignette: { darkness: ev.value } });
    });

  pane.addButton({ title: "Reset" }).on("click", () => {
    params.technique = "default";
    params.offset = 0.5;
    params.darkness = 0.5;
    params.visible = true;
    pane.refresh();
    vignetteLayer.update({
      vignette: {
        technique: "default",
        offset: 0.5,
        darkness: 0.5,
      },
      visible: true,
    });
  });

  addDateControl(view, pane);
  addCameraControl(view, pane);
  showAttributions([TILE_DATASETS.openstreetmap]);
};
