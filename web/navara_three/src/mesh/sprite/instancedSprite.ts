import {
  PointMesh as NavaraPointMesh,
  BillboardMesh as NavaraBillboardMesh,
} from "@navaramap/engine";
import { degreeToRadian } from "@navaramap/three_api";
import {
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Object3D,
  ShaderMaterial,
  BufferAttribute,
  type BufferGeometry,
  Color,
  type Material,
  PerspectiveCamera,
  Vector2,
} from "three";
import invariant from "tiny-invariant";

import {
  DECLUTTER_FADE_MS,
  type DeclutterCandidate,
  type DeclutterParticipant,
} from "../../declutter/types";
import type { EventContext } from "../../event/context";
import { createInstancedSpriteMaterialEnhancer } from "../../material/enhancer";
import type { CustomObject3DEventMap } from "../../object3DEvent";
import { PickableMesh } from "../pickableMesh";

import { BillboardAtlas, type AtlasRect } from "./billboardAtlas";
import { loadAtlasImageFromUrl } from "./billboardAtlasImageLoader";

export type InstancedSpriteOptions = {
  renderOrder?: number;
  ctx: EventContext;
};

type PositionsInfo = {
  position:
    | Float32Array<ArrayBufferLike>
    | {
        high: Float32Array<ArrayBufferLike>;
        low: Float32Array<ArrayBufferLike>;
      };
  batchIDs: Float32Array<ArrayBufferLike> | null;
  positionSize: number;
  batchIDSize: number;
  nPositions: number;
  RTE: boolean;
};

/** Reusable Vector2 to avoid per-frame allocations in onBeforeRender. */
const _tmpSize = new Vector2();

// Coupled with crates/navara_feature/src/geometry/point.rs::pixel_to_world
export class InstancedSpriteMesh
  extends Mesh<BufferGeometry, Material | Material[], CustomObject3DEventMap>
  implements PickableMesh, DeclutterParticipant
{
  private _batchIdToInstance = new Map<number, number>();
  private _initialColor: Color = new Color(0xffffff);
  private _initialHeight = 0.0;
  private _initialSize = -1.0; // Negative value indicates "use uScale" in shader
  private _atlas?: BillboardAtlas;
  private _defaultUrl?: string;
  /** Atlas rect of the current default image; re-applied to an instance when
   * its per-feature override is cleared. */
  private _defaultRect?: AtlasRect;
  /** Instance ids whose image was overridden per-feature; the default image
   * from the material no longer applies to them. */
  private _imageOverrides = new Set<number>();
  /** Latest override URL requested per instance. An async pack only applies
   * if it still matches, so a newer override or a clear wins over slow loads. */
  private _requestedImageUrls = new Map<number, string>();
  /** Forwards the atlas byte footprint to the engine's memory ledger; wired
   * by the feature-added handler once the owning entity bits are known. */
  private _atlasBytesReporter?: (bytes: number) => void;
  private _reportedAtlasBytes = 0;
  private _active = true;
  readonly ctx: EventContext;
  /** Material enhancer for encapsulated state management */
  private _enhancedMaterial?: ReturnType<
    typeof createInstancedSpriteMaterialEnhancer
  >;
  /** Per-instance world anchors in ECEF meters (f64, 3 per instance), kept in
   *  sync with the position attributes for the declutter pass. */
  private _anchors: Float64Array | null = null;
  /** Whether this mesh's instances participate in screen-space decluttering. */
  private _declutter = false;
  /** Layer-level placement priority from the material. */
  private _declutterPriority = 0;
  /** Per-instance priorities set through the evaluator (NaN = no override,
   *  fall back to the layer value). Lazily allocated on first use. */
  private _declutterPriorityOverrides: Float32Array | null = null;
  /** Per-instance fade targets for `instanceDeclutterHide` (0 = shown,
   *  1 = hidden); the attribute animates toward these in stepDeclutterFade. */
  private _declutterTargets: Float32Array | null = null;
  /** True while any instance's hide factor may differ from its target. */
  private _declutterAnimating = false;

  constructor(options: InstancedSpriteOptions) {
    super();
    this.renderOrder = options.renderOrder ?? this.renderOrder;
    this.ctx = options.ctx;
    this.ctx.declutter?.register(this);
    // `processObjectRemoved` dispatches this for every removed mesh; it is the
    // reliable teardown signal (this class's dispose() is not called there).
    this.addEventListener("removedFromWorld", () => {
      this.ctx.declutter?.unregister(this);
    });
  }

  setActive(active: boolean) {
    this._active = active;
    this.updateVisibility();
    this.ctx.declutter?.markDirty();
  }

  // --- DeclutterParticipant ---

  collectDeclutterCandidates(out: DeclutterCandidate[]): void {
    if (!this.visible || !this._declutter || !this._anchors) return;
    const enhancer = this._enhancedMaterial;
    const params = this.geometry?.getAttribute("instanceParams") as
      | InstancedBufferAttribute
      | undefined;
    if (!enhancer || !params) return;

    const state = enhancer.states();
    const cx = Math.min(Math.max(state.center[0], -0.5), 0.5);
    const cy = Math.min(Math.max(state.center[1], -0.5), 0.5);
    // Mirror of instancedSprite.vert.glsl:100-104 — aspect is per-instance
    // (from the atlas rect), not a material-level uniform; there is no
    // material-wide "aspect" state to read.
    const uvRect = state.billboard
      ? (this.geometry?.getAttribute("instanceUvRect") as
          | InstancedBufferAttribute
          | undefined)
      : undefined;
    const anchors = this._anchors;
    const overrides = this._declutterPriorityOverrides;
    const targets = this._declutterTargets;
    const count = Math.min(params.count, anchors.length / 3);

    for (let i = 0; i < count; i++) {
      if (params.getZ(i) <= 0.5) continue; // hidden by user `show`
      const instanceSize = params.getY(i);
      const size = instanceSize >= 0.0 ? instanceSize : state.scale;
      if (size <= 0.0) continue;

      const override = overrides ? overrides[i] : Number.NaN;
      const rectH = uvRect ? uvRect.getW(i) : 0;
      const aspect = uvRect && rectH > 0.0 ? uvRect.getZ(i) / rectH : 1.0;

      // Mirror of instancedSprite.vert.glsl:95-97 — the quad spans
      // (position.xy - center) * vec2(aspect, 1) * size around the anchor.
      out.push({
        anchorX: anchors[i * 3],
        anchorY: anchors[i * 3 + 1],
        anchorZ: anchors[i * 3 + 2],
        addHeight: params.getX(i),
        minX: (-0.5 - cx) * aspect * size,
        maxX: (0.5 - cx) * aspect * size,
        minY: (-0.5 - cy) * size,
        maxY: (0.5 - cy) * size,
        sizeInMeters: state.sizeInMeters,
        // NaN-safe: an unset override falls back to the layer priority.
        priority: Number.isNaN(override) ? this._declutterPriority : override,
        isShown: targets ? targets[i] === 0 : true,
        owner: this,
        handle: i,
      });
    }
  }

  applyDeclutter(handle: number, hidden: boolean): void {
    this.setDeclutterHiddenByInstance(handle, hidden);
  }

  stepDeclutterFade(deltaMs: number): boolean {
    if (!this._declutterAnimating) return false;
    const attr = this.geometry?.getAttribute("instanceDeclutterHide") as
      | InstancedBufferAttribute
      | undefined;
    const targets = this._declutterTargets;
    if (!attr || !targets) {
      this._declutterAnimating = false;
      return false;
    }

    const step = deltaMs / DECLUTTER_FADE_MS;
    const count = Math.min(attr.count, targets.length);
    let stillAnimating = false;
    let changed = false;
    for (let i = 0; i < count; i++) {
      let value = attr.getX(i);
      const target = targets[i];
      if (value === target) continue;
      value =
        value < target
          ? Math.min(value + step, target)
          : Math.max(value - step, target);
      attr.setX(i, value);
      changed = true;
      if (value !== target) stillAnimating = true;
    }
    if (changed) attr.needsUpdate = true;
    this._declutterAnimating = stillAnimating;
    return stillAnimating;
  }

  private _cacheDeclutterState(m: NavaraPointMesh | NavaraBillboardMesh) {
    const nextDeclutter = m.material.declutter ?? true;
    if (this._declutter && !nextDeclutter) {
      // Leaving declutter mode: clear hides the pass applied — the mesh stops
      // producing candidates, so nothing else would ever re-show them.
      this._clearDeclutterHidden();
    }
    this._declutter = nextDeclutter;
    this._declutterPriority = m.material.declutterPriority ?? 0;
  }

  private _clearDeclutterHidden(): void {
    const targets = this._declutterTargets;
    if (!targets) return;
    targets.fill(0.0);
    // Everything fades back in from wherever its hide factor currently is.
    this._declutterAnimating = true;
  }

  /** Reconstruct absolute ECEF anchors from the same arrays the position
   *  attributes receive (RTE high+low split, or RTC-relative + center). */
  private _cacheAnchors(
    positionsInfo: PositionsInfo,
    transform: { tx: number; ty: number; tz: number },
  ): void {
    const { nPositions, positionSize, RTE } = positionsInfo;
    const anchors =
      this._anchors && this._anchors.length === nPositions * 3
        ? this._anchors
        : new Float64Array(nPositions * 3);

    if (RTE) {
      const pos = positionsInfo.position as {
        high: Float32Array<ArrayBufferLike>;
        low: Float32Array<ArrayBufferLike>;
      };
      for (let i = 0; i < nPositions; i++) {
        const s = i * positionSize;
        anchors[i * 3] = pos.high[s] + pos.low[s];
        anchors[i * 3 + 1] = pos.high[s + 1] + pos.low[s + 1];
        anchors[i * 3 + 2] = (pos.high[s + 2] ?? 0.0) + (pos.low[s + 2] ?? 0.0);
      }
    } else {
      const pos = positionsInfo.position as Float32Array<ArrayBufferLike>;
      for (let i = 0; i < nPositions; i++) {
        const s = i * positionSize;
        anchors[i * 3] = pos[s] + transform.tx;
        anchors[i * 3 + 1] = pos[s + 1] + transform.ty;
        anchors[i * 3 + 2] = (pos[s + 2] ?? 0.0) + transform.tz;
      }
    }
    this._anchors = anchors;
  }

  async _init(m: NavaraPointMesh | NavaraBillboardMesh) {
    const positionsInfo = this.extractPositions(m);
    if (positionsInfo === null) {
      console.warn("No position data found for InstancedSpriteMesh");
      return;
    }

    this._cacheDeclutterState(m);
    this._cacheAnchors(positionsInfo, m.transform);

    // Create Geometry
    this.geometry = this._initGeometry(positionsInfo, m);

    // Create Material
    this.material = await this._initMaterial(positionsInfo, m);

    this.frustumCulled = false; // Disable since bounding box doesn't account for instance positions
    this.ctx.declutter?.markDirty();
  }

  async _update(m: NavaraPointMesh | NavaraBillboardMesh) {
    const enhancer = this.getEnhancer();
    const material = this.material as ShaderMaterial;

    this._cacheDeclutterState(m);

    if (material.visible !== m.material.show) {
      material.visible = m.material.show ?? true;
      this.updateVisibility();
    }

    // Update enhancer state for uniform-backed properties
    enhancer.update({
      base: {
        scale: m.material.size ?? 100.0,
        center: [m.material.center?.x ?? 0.0, m.material.center?.y ?? 0.0],
        sizeInMeters: m.material.sizeInMeters ?? true,
        offsetDepth: m.material.offsetDepth ?? true,
        transparent: m.material.transparent ?? true,
        depthTest: m.material.depthTest ?? true,
        effectIdsMask:
          this.ctx.viewContext.selectiveEffectRegistry?.computeMask(
            m.material.effectIds ?? [],
          ) ?? 0,
        emissiveColor: m.material.emissiveColor ?? 0,
        emissiveIntensity: m.material.emissiveIntensity ?? 0,
      },
    });

    // Color (per-instance attribute)
    if (this._initialColor.getHex() !== (m.material.color ?? 0xffffff)) {
      this._initialColor.setHex(m.material.color ?? 0xffffff);
      const colorAttr = this.geometry.getAttribute(
        "instanceColor",
      ) as InstancedBufferAttribute;
      const instanceCount = colorAttr.count;
      for (let i = 0; i < instanceCount; i++) {
        colorAttr.setXYZ(
          i,
          this._initialColor.r,
          this._initialColor.g,
          this._initialColor.b,
        );
      }
      colorAttr.needsUpdate = true;
    }

    // Height (per-instance attribute - X component of instanceParams vec4)
    if (this._initialHeight !== (m.material.height ?? 0.0)) {
      this._initialHeight = m.material.height ?? 0.0;
      const paramsAttr = this.geometry.getAttribute(
        "instanceParams",
      ) as InstancedBufferAttribute;
      const instanceCount = paramsAttr.count;
      for (let i = 0; i < instanceCount; i++) {
        paramsAttr.setX(i, m.material.height ?? 0.0);
      }
      paramsAttr.needsUpdate = true;
    }

    // Position updates (per-instance attributes)
    {
      const positionsInfo = this.extractPositions(m);

      if (positionsInfo) {
        this._cacheAnchors(positionsInfo, m.transform);
        if (positionsInfo.RTE) {
          const pos = positionsInfo.position as {
            high: Float32Array<ArrayBufferLike>;
            low: Float32Array<ArrayBufferLike>;
          };
          const pLow = this.geometry.getAttribute(
            "instancePositionLOW",
          ) as InstancedBufferAttribute;
          const pHigh = this.geometry.getAttribute(
            "instancePositionHIGH",
          ) as InstancedBufferAttribute;
          pLow.copyArray(pos.low);
          pHigh.copyArray(pos.high);
          pLow.needsUpdate = true;
          pHigh.needsUpdate = true;
        } else {
          const pos = positionsInfo.position as Float32Array<ArrayBufferLike>;
          const p = this.geometry.getAttribute(
            "instancePosition",
          ) as InstancedBufferAttribute;
          p.copyArray(pos);
          p.needsUpdate = true;
        }
      }
    }

    // Billboard-specific updates
    if (m instanceof NavaraBillboardMesh) {
      enhancer.update({
        base: { alphaTest: m.material.alphaTest ?? 0.0 },
      });

      if (m.material.url) {
        await this._setDefaultImage(m.material.url);
      }
    }

    this.ctx.declutter?.markDirty();
  }

  private _initGeometry(
    positionsInfo: PositionsInfo,
    m: NavaraPointMesh | NavaraBillboardMesh,
  ) {
    invariant(positionsInfo.batchIDs, "Batch IDs not found!");

    // prettier-ignore
    const vertices = new Float32Array([
      -0.5, -0.5, 0.0, // v0
       0.5, -0.5, 0.0, // v1
       0.5,  0.5, 0.0, // v2
      -0.5, -0.5, 0.0, // v3
       0.5,  0.5, 0.0, // v4
      -0.5,  0.5, 0.0, // v5
    ]);

    // prettier-ignore
    const uvs = new Float32Array([
      0.0, 0.0, // v0
      1.0, 0.0, // v1
      1.0, 1.0, // v2
      0.0, 0.0, // v3
      1.0, 1.0, // v4
      0.0, 1.0, // v5
    ]);

    const instanceCount = positionsInfo.nPositions;

    // Create the Instanced Mesh
    // We use InstancedBufferGeometry to inject our custom attributes
    const instancedGeometry = new InstancedBufferGeometry();
    instancedGeometry.setAttribute(
      "position",
      new BufferAttribute(vertices, 3),
    );
    instancedGeometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    instancedGeometry.instanceCount = instanceCount;

    // Add Custom Attributes
    // instanceParams: vec4(height, size, show, opacity)
    const paramsBuffer = new Float32Array(instanceCount * 4);
    const colorBuffer = new Float32Array(instanceCount * 3);

    this._initialColor = new Color().setHex(m.material.color ?? 0xffffff);
    // instanceSize defaults to a negative value to indicate "use uScale" in the shader.
    this._initialSize = -1.0;
    const initialShow =
      m.material.show !== undefined ? (m.material.show ? 1.0 : 0.0) : 1.0;
    const initialOpacityRaw = m.material.opacity ?? 1.0;
    const initialOpacity = Number.isFinite(initialOpacityRaw)
      ? Math.max(0.0, Math.min(1.0, initialOpacityRaw))
      : 1.0;

    for (let i = 0; i < instanceCount; i++) {
      paramsBuffer[i * 4 + 0] = m.material.height ?? 0.0; // height
      paramsBuffer[i * 4 + 1] = this._initialSize; // size
      paramsBuffer[i * 4 + 2] = initialShow; // show
      paramsBuffer[i * 4 + 3] = initialOpacity; // opacity

      colorBuffer[i * 3 + 0] = this._initialColor.r;
      colorBuffer[i * 3 + 1] = this._initialColor.g;
      colorBuffer[i * 3 + 2] = this._initialColor.b;

      // Map batch ID to instance id
      // assuming batch IDs are 32bit floats
      const batchId = positionsInfo.batchIDs[i];
      this._batchIdToInstance.set(batchId, i);
    }

    if (m instanceof NavaraBillboardMesh) {
      // instanceUvRect: vec4(x, y, w, h) — this instance's atlas sub-rect in
      // pixels. Zeroed until an image is packed; a zero-height rect samples a
      // transparent texel, so instances stay invisible rather than garbled.
      instancedGeometry.setAttribute(
        "instanceUvRect",
        new InstancedBufferAttribute(new Float32Array(instanceCount * 4), 4),
      );
    }

    if (positionsInfo.RTE) {
      const pos = positionsInfo.position as {
        high: Float32Array<ArrayBufferLike>;
        low: Float32Array<ArrayBufferLike>;
      };
      instancedGeometry.setAttribute(
        "instancePositionLOW",
        new InstancedBufferAttribute(pos.low, positionsInfo.positionSize),
      );
      instancedGeometry.setAttribute(
        "instancePositionHIGH",
        new InstancedBufferAttribute(pos.high, positionsInfo.positionSize),
      );
    } else {
      const pos = positionsInfo.position as Float32Array<ArrayBufferLike>;
      instancedGeometry.setAttribute(
        "instancePosition",
        new InstancedBufferAttribute(pos, positionsInfo.positionSize),
      );
    }
    instancedGeometry.setAttribute(
      "instanceParams",
      new InstancedBufferAttribute(paramsBuffer, 4),
    );
    instancedGeometry.setAttribute(
      "instanceColor",
      new InstancedBufferAttribute(colorBuffer, 3),
    );
    // Declutter hide factors (0 = shown … 1 = hidden). Decluttered instances
    // start hidden and fade in once the placement pass grants them space, so
    // dense tiles don't flash their full clutter before the first pass runs.
    const initialHide = this._declutter ? 1.0 : 0.0;
    const declutterBuffer = new Float32Array(instanceCount).fill(initialHide);
    this._declutterTargets = new Float32Array(instanceCount).fill(initialHide);
    instancedGeometry.setAttribute(
      "instanceDeclutterHide",
      new InstancedBufferAttribute(declutterBuffer, 1),
    );
    instancedGeometry.setAttribute(
      "instanceBatchID",
      new InstancedBufferAttribute(
        positionsInfo.batchIDs,
        positionsInfo.batchIDSize,
      ),
    );

    return instancedGeometry;
  }

  private async _initMaterial(
    positionsInfo: PositionsInfo,
    m: NavaraPointMesh | NavaraBillboardMesh,
  ) {
    const isBillboard = m instanceof NavaraBillboardMesh;
    const material = new ShaderMaterial();

    // Create enhancer
    const enhancer = createInstancedSpriteMaterialEnhancer(material);
    this._enhancedMaterial = enhancer;

    // Mount with initial props
    enhancer.mount({
      base: {
        useRTE: positionsInfo.RTE,
        billboard: isBillboard,
        scale: m.material.size ?? 100.0,
        center: [m.material.center?.x ?? 0.0, m.material.center?.y ?? 0.0],
        sizeInMeters: m.material.sizeInMeters ?? true,
        offsetDepth: m.material.offsetDepth ?? true,
        alphaTest: isBillboard ? (m.material.alphaTest ?? 0.0) : 0.0,
        pickable: false,
        transparent: m.material.transparent ?? true,
        depthTest: m.material.depthTest ?? true,
        rtcCenter: [m.transform.tx, m.transform.ty, m.transform.tz],
      },
    });

    // Initialize uniforms early so they're available before onBeforeCompile
    const mutates = enhancer.mutates();
    mutates.updateUniforms(material.uniforms, enhancer.states());

    // Set up onBeforeRender for per-frame updates (farPlane + RTE eye position)
    material.onBeforeRender = (
      _renderer,
      _scene,
      camera,
      _geometry,
      _mat,
      _group,
    ) => {
      const pCam = camera as PerspectiveCamera;
      mutates.updateFarPlane(pCam.far);
      mutates.updateFovRad(degreeToRadian(pCam.fov));
      mutates.updateScreenHeightPx(
        _renderer.getDrawingBufferSize(_tmpSize).y / _renderer.getPixelRatio(),
      );

      if (positionsInfo.RTE) {
        mutates.updateRteUniforms(
          camera.position.x,
          camera.position.y,
          camera.position.z,
          enhancer.states(),
        );
      } else {
        mutates.updateRtcUniforms(camera.matrixWorldInverse, enhancer.states());
      }
    };

    // Set custom program cache key and onBeforeCompile
    material.customProgramCacheKey = enhancer.programCacheKey;
    material.onBeforeCompile = enhancer.transformShader;

    // Handle billboard texture
    if (isBillboard && m.material.url) {
      await this._setDefaultImage(m.material.url);
    }

    material.visible = m.material.show ?? true;
    this.updateVisibility();
    return material;
  }

  private updateVisibility() {
    const material = this.material;
    const materialVisible =
      material instanceof ShaderMaterial ? material.visible : true;
    this.visible = this._active && materialVisible;
  }

  private extractPositions(
    m: NavaraPointMesh | NavaraBillboardMesh,
  ): PositionsInfo | null {
    const { buf } = this.ctx;
    const g = m.geometry;

    const batchIdsData = g.batch_ids;
    const batchIDs = buf.removeF32(batchIdsData.data);
    const batchIDSize = batchIdsData.size;

    const positionData = g.position;
    const position = positionData
      ? buf.removeF32(positionData.data)
      : undefined;

    if (position && positionData) {
      const positionSize = positionData.size;
      const nPositions = position.length / positionSize;

      return {
        position,
        batchIDs,
        batchIDSize,
        positionSize,
        nPositions,
        RTE: false,
      };
    }

    const positionHighData = g.position_3d_high;
    const positionLowData = g.position_3d_low;
    const positionHigh = positionHighData
      ? buf.removeF32(positionHighData.data)
      : undefined;
    const positionLow = positionLowData
      ? buf.removeF32(positionLowData.data)
      : undefined;

    if (positionHigh && positionLow && positionHighData && positionLowData) {
      const positionLowSize = positionLowData.size;
      const positionHighSize = positionHighData.size;
      invariant(
        positionLowSize === positionHighSize,
        "Position high and low size mismatch",
      );

      const nPositions = positionHigh.length / positionHighSize;

      return {
        position: { high: positionHigh, low: positionLow },
        batchIDs,
        batchIDSize,
        positionSize: positionHighSize,
        nPositions,
        RTE: true,
      };
    }

    return null;
  }

  private _ensureAtlas(): BillboardAtlas {
    this._atlas ??= new BillboardAtlas({ loadImage: loadAtlasImageFromUrl });
    return this._atlas;
  }

  /**
   * Wire the callback that reports this mesh's atlas footprint to the
   * engine's memory ledger, and immediately report the current footprint —
   * the default image may have been packed during `_init`, before the
   * feature-added handler could wire the reporter.
   */
  setAtlasBytesReporter(reporter: (bytes: number) => void): void {
    this._atlasBytesReporter = reporter;
    this._reportAtlasBytes();
  }

  /** Report the atlas footprint if it changed since the last report. Must run
   * after every `pack()` — the atlas may have grown even when the pack failed
   * (growth up to `maxSize` happens before "no space" is decided). */
  private _reportAtlasBytes(): void {
    if (!this._atlasBytesReporter) return;
    const bytes = this._atlas?.byteLength ?? 0;
    if (bytes === this._reportedAtlasBytes) return;
    this._reportedAtlasBytes = bytes;
    this._atlasBytesReporter(bytes);
  }

  /**
   * Push the atlas texture and size to the material. The texture object is
   * replaced whenever the atlas grows, so this must run after every pack().
   */
  private _syncAtlasUniforms(): void {
    const atlas = this._atlas;
    if (!atlas) return;
    this.getEnhancer().update({
      base: {
        texture: { value: atlas.texture },
        atlasSize: [atlas.size, atlas.size],
      },
    });
  }

  /**
   * Load the material-level image and apply its rect to every instance that
   * hasn't been overridden per-feature via setFeatureImageByBatchId.
   */
  private async _setDefaultImage(url: string): Promise<void> {
    if (this._defaultUrl === url) return;
    this._defaultUrl = url;

    const rect = await this._ensureAtlas().pack(url);
    this._reportAtlasBytes();
    if (!rect) return;
    // A newer default image won the race while this one was loading.
    if (this._defaultUrl !== url) return;

    this._defaultRect = rect;
    this._syncAtlasUniforms();
    const rectAttr = this.geometry.getAttribute(
      "instanceUvRect",
    ) as InstancedBufferAttribute;
    for (let i = 0; i < rectAttr.count; i++) {
      if (this._imageOverrides.has(i)) continue;
      rectAttr.setXYZW(i, rect.x, rect.y, rect.w, rect.h);
    }
    rectAttr.needsUpdate = true;
  }

  onBeforePicking(): void {
    this.getEnhancer().update({ base: { pickable: true } });
  }

  onAfterPicking(): void {
    this.getEnhancer().update({ base: { pickable: false } });
  }

  getRenderable(): Object3D {
    return this;
  }

  /**
   * Get the enhancer, throwing if not initialized.
   */
  private getEnhancer(): NonNullable<typeof this._enhancedMaterial> {
    if (!this._enhancedMaterial) {
      throw new Error(
        "InstancedSpriteMesh material enhancer is not initialized. This usually indicates a failure during construction or geometry/material setup.",
      );
    }
    return this._enhancedMaterial;
  }

  setFeatureColorByBatchId(batchId: number, color: Color) {
    const instanceId = this._batchIdToInstance.get(batchId);
    if (instanceId === undefined) return;

    const colorAttr = this.geometry.getAttribute(
      "instanceColor",
    ) as InstancedBufferAttribute;
    colorAttr.setXYZ(instanceId, color.r, color.g, color.b);
    colorAttr.needsUpdate = true;
  }

  setFeatureShowByBatchId(batchId: number, rawVisible: boolean) {
    const instanceId = this._batchIdToInstance.get(batchId);
    if (instanceId === undefined) return;

    const paramsAttr = this.geometry.getAttribute(
      "instanceParams",
    ) as InstancedBufferAttribute;
    paramsAttr.setZ(instanceId, rawVisible ? 1.0 : 0.0);
    paramsAttr.needsUpdate = true;
    this.ctx.declutter?.markDirty();
  }

  setFeatureOpacityByBatchId(batchId: number, opacity: number) {
    const instanceId = this._batchIdToInstance.get(batchId);
    if (instanceId === undefined) return;

    const paramsAttr = this.geometry.getAttribute(
      "instanceParams",
    ) as InstancedBufferAttribute;
    const clampedOpacity = Number.isFinite(opacity)
      ? Math.max(0.0, Math.min(1.0, opacity))
      : 1.0;
    paramsAttr.setW(instanceId, clampedOpacity);
    paramsAttr.needsUpdate = true;
  }

  setFeatureHeightByBatchId(batchId: number, height: number) {
    const instanceId = this._batchIdToInstance.get(batchId);
    if (instanceId === undefined) return;

    const paramsAttr = this.geometry.getAttribute(
      "instanceParams",
    ) as InstancedBufferAttribute;

    const sanitizedHeight = Number.isFinite(height) ? height : 0.0;
    paramsAttr.setX(instanceId, sanitizedHeight);
    paramsAttr.needsUpdate = true;
    this.ctx.declutter?.markDirty();
  }

  /**
   * Set one instance's declutter fade target; the attribute animates toward
   * it in {@link stepDeclutterFade}. Deliberately separate from the `show`
   * component of `instanceParams` so user-driven visibility and declutter
   * results compose instead of clobbering each other.
   */
  setDeclutterHiddenByInstance(instanceIndex: number, hidden: boolean) {
    const targets = this._declutterTargets;
    if (!targets || instanceIndex < 0 || instanceIndex >= targets.length) {
      return;
    }
    targets[instanceIndex] = hidden ? 1.0 : 0.0;
    // Cheap over-approximation; stepDeclutterFade clears it when everything
    // has reached its target.
    this._declutterAnimating = true;
  }

  /**
   * Set a per-feature placement priority (higher wins), overriding the
   * layer-level `declutterPriority` for this instance. Driven by the feature
   * evaluator.
   */
  setFeatureDeclutterPriorityByBatchId(batchId: number, priority: number) {
    const instanceId = this._batchIdToInstance.get(batchId);
    if (instanceId === undefined) return;

    if (!this._declutterPriorityOverrides) {
      const count = this._anchors ? this._anchors.length / 3 : 0;
      if (count === 0) return;
      this._declutterPriorityOverrides = new Float32Array(count).fill(
        Number.NaN,
      );
    }
    if (instanceId >= this._declutterPriorityOverrides.length) return;
    if (this._declutterPriorityOverrides[instanceId] === priority) return;
    this._declutterPriorityOverrides[instanceId] = priority;
    this.ctx.declutter?.markDirty();
  }

  setFeatureSizeByBatchId(batchId: number, size: number) {
    const instanceId = this._batchIdToInstance.get(batchId);
    if (instanceId === undefined) return;

    const paramsAttr = this.geometry.getAttribute(
      "instanceParams",
    ) as InstancedBufferAttribute;

    const sanitizedSize = Number.isFinite(size)
      ? size < 0.0
        ? -1.0
        : size
      : -1.0;
    paramsAttr.setY(instanceId, sanitizedSize);
    paramsAttr.needsUpdate = true;
    this.ctx.declutter?.markDirty();
  }

  /**
   * Give one feature its own image, packed into this mesh's texture atlas.
   * Loads are deduplicated by URL, so styling many features with few distinct
   * images fetches each image once. On load failure the feature keeps its
   * current (default) image. Passing a nullish `url` clears the override and
   * reverts the feature to the material's default image. No-op for
   * non-billboard (point) meshes.
   */
  async setFeatureImageByBatchId(
    batchId: number,
    url: string | null | undefined,
  ): Promise<void> {
    const instanceId = this._batchIdToInstance.get(batchId);
    if (instanceId === undefined) return;

    const rectAttr = this.geometry.getAttribute("instanceUvRect") as
      InstancedBufferAttribute | undefined;
    if (!rectAttr) return;

    if (url == null) {
      this._requestedImageUrls.delete(instanceId);
      if (!this._imageOverrides.delete(instanceId)) return;
      // Zero rect (invisible) until the default image finishes loading, same
      // as instances that never had an override.
      const rect = this._defaultRect;
      rectAttr.setXYZW(
        instanceId,
        rect?.x ?? 0,
        rect?.y ?? 0,
        rect?.w ?? 0,
        rect?.h ?? 0,
      );
      rectAttr.needsUpdate = true;
      return;
    }

    this._requestedImageUrls.set(instanceId, url);
    const rect = await this._ensureAtlas().pack(url);
    this._reportAtlasBytes();
    if (!rect) return;
    // A newer override or a clear superseded this load while it was in flight.
    if (this._requestedImageUrls.get(instanceId) !== url) return;

    this._imageOverrides.add(instanceId);
    this._syncAtlasUniforms();
    rectAttr.setXYZW(instanceId, rect.x, rect.y, rect.w, rect.h);
    rectAttr.needsUpdate = true;
  }

  dispose(): void {
    this.ctx.declutter?.unregister(this);
    this.geometry?.dispose();

    // The material's uTexture points at the atlas texture; the atlas owns it.
    this._atlas?.dispose();
    this._atlas = undefined;

    // Clear this mesh's atlas term from the memory ledger. When disposal was
    // caused by the owning tile's eviction the entity is already gone and the
    // report is a no-op; when only this feature was removed the tile survives
    // and the term must not linger.
    if (this._reportedAtlasBytes !== 0) {
      this._reportedAtlasBytes = 0;
      this._atlasBytesReporter?.(0);
    }

    (this.material as ShaderMaterial).dispose();

    // Clear internal collections to release references
    this._batchIdToInstance.clear();
    this._anchors = null;
    this._declutterTargets = null;
    this._declutterPriorityOverrides = null;
    this._imageOverrides.clear();
    this._requestedImageUrls.clear();
  }
}
