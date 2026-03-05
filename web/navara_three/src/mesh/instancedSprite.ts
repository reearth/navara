import {
  PointMesh as NavaraPointMesh,
  BillboardMesh as NavaraBillboardMesh,
} from "@navara/engine";
import {
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  BufferAttribute,
  DataArrayTexture,
  UnsignedByteType,
  RGBAFormat,
  LinearFilter,
  Color,
  PerspectiveCamera,
} from "three";
import invariant from "tiny-invariant";

import type { ViewContext } from "../core";
import { updateEffectLinks, unlinkEffects } from "../core/SelectiveEffectHelper";
import { injectSelectiveEffectHandlers } from "../core/SelectiveEffectMaskContext";
import type { BufferLoader } from "../event";
import { TEXTURE_LOADER } from "../event/loaders";
import { createInstancedSpriteMaterialEnhancer } from "../material/enhancer";
import { getImageDataFromImageBitmap } from "../tasks/getImageDataFromImageBitmap";

import { PickableMesh } from "./pickableMesh";

export type InstancedSpriteOptions = {
  renderOrder?: number;
  viewContext: ViewContext;
  layerId: string;
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

export class InstancedSpriteMesh extends Mesh implements PickableMesh {
  private _batchIdToInstance = new Map<number, number>();
  private _initialColor: Color = new Color(0xffffff);
  private _initialHeight = 0.0;
  private _loadedUrls = new Set<string>();
  /** ViewContext for SelectiveEffect handling */
  private _viewContext: ViewContext;
  /** Layer ID for SelectiveEffect handling */
  private _layerId: string;
  /** Previous effectIds for SelectiveEffect registry diff */
  private _prevEffectIds?: string[];
  /** Material enhancer for encapsulated state management */
  private _enhancedMaterial?: ReturnType<
    typeof createInstancedSpriteMaterialEnhancer
  >;

  constructor(options: InstancedSpriteOptions) {
    super();
    this.renderOrder = options.renderOrder ?? this.renderOrder;
    this._viewContext = options.viewContext;
    this._layerId = options.layerId;
  }

  async _init(m: NavaraPointMesh | NavaraBillboardMesh, buf: BufferLoader) {
    const positionsInfo = this.extractPositions(m, buf);
    if (positionsInfo === null) {
      console.warn("No position data found for InstancedSpriteMesh");
      return;
    }

    // Create Geometry
    this.geometry = this._initGeometry(positionsInfo, m);

    // Create Material
    this.material = await this._initMaterial(positionsInfo, m);

    // SE uniform refs for combined mask pass output
    const mat = this.material as ShaderMaterial;
    const seBloomRef = { value: 0 };
    const seOutlineRef = { value: 0 };
    mat.uniforms.uBloomMaskPass = seBloomRef;
    mat.uniforms.uOutlineMaskPass = seOutlineRef;

    // Inject selective effect mask-pass handlers
    injectSelectiveEffectHandlers(this, {
      registry: this._viewContext?.selectiveEffectRegistry,
      layerId: this._layerId,
      shaderUniforms: {
        uBloomMaskPass: seBloomRef,
        uOutlineMaskPass: seOutlineRef,
      },
    });

    // Register initial effectIds (from first init data)
    const initUpdated = updateEffectLinks(
      this,
      this._viewContext.selectiveEffectRegistry,
      this._layerId,
      this._prevEffectIds,
      m.material.effectIds,
    );
    if (initUpdated !== undefined) this._prevEffectIds = initUpdated;

    this.frustumCulled = false; // Disable since bounding box doesn't account for instance positions
  }

  async _update(
    m: NavaraPointMesh | NavaraBillboardMesh,
    buf: BufferLoader,
    active: boolean,
  ) {
    const enhancer = this.getEnhancer();
    const material = this.material as ShaderMaterial;

    // Update visibility (combines show + active)
    if (material.visible !== m.material.show) {
      material.visible = m.material.show ?? true;
      material.visible = material.visible && active;
    }

    // Update enhancer state for uniform-backed properties
    enhancer.update({
      base: {
        scale: m.material.size ?? 100.0,
        center: [m.material.center?.x ?? 0.0, m.material.center?.y ?? 0.0],
        scaleByDistance: m.material.scaleByDistance ?? true,
        offsetDepth: m.material.offsetDepth ?? true,
        transparent: m.material.transparent ?? true,
        depthTest: m.material.depthTest ?? true,
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

    // Height (per-instance attribute)
    if (this._initialHeight !== (m.material.height ?? 0.0)) {
      this._initialHeight = m.material.height ?? 0.0;
      const heightAttr = this.geometry.getAttribute(
        "instanceHeight",
      ) as InstancedBufferAttribute;
      const instanceCount = heightAttr.count;
      for (let i = 0; i < instanceCount; i++) {
        heightAttr.setX(i, m.material.height ?? 0.0);
      }
      heightAttr.needsUpdate = true;
    }

    // Position updates (per-instance attributes)
    {
      const positionsInfo = this.extractPositions(m, buf);

      if (positionsInfo) {
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
        const layerIndex = await this.uploadTexture(m.material.url, material);
        if (layerIndex !== undefined) {
          const layerAttr = this.geometry.getAttribute(
            "instanceLayer",
          ) as InstancedBufferAttribute;
          const instanceCount = layerAttr.count;
          for (let i = 0; i < instanceCount; i++) {
            layerAttr.setX(i, layerIndex);
          }
          layerAttr.needsUpdate = true;
        }
      }
    }

    // SelectiveEffect: effectIds handling
    const updated = updateEffectLinks(
      this,
      this._viewContext.selectiveEffectRegistry,
      this._layerId,
      this._prevEffectIds,
      m.material.effectIds,
    );
    if (updated !== undefined) this._prevEffectIds = updated;
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
    const heightBuffer = new Float32Array(instanceCount);
    const showBuffer = new Float32Array(instanceCount);
    const colorBuffer = new Float32Array(instanceCount * 3);
    let layerBuffer = undefined;

    this._initialColor = new Color().setHex(m.material.color ?? 0xffffff);
    for (let i = 0; i < instanceCount; i++) {
      heightBuffer[i] = m.material.height ?? 0.0;
      showBuffer[i] =
        m.material.show !== undefined ? (m.material.show ? 1.0 : 0.0) : 1.0;

      colorBuffer[i * 3 + 0] = this._initialColor.r;
      colorBuffer[i * 3 + 1] = this._initialColor.g;
      colorBuffer[i * 3 + 2] = this._initialColor.b;

      // Map batch ID to instance id
      // assuming batch IDs are 32bit floats
      const batchId = positionsInfo.batchIDs[i];
      this._batchIdToInstance.set(batchId, i);
    }

    if (m instanceof NavaraBillboardMesh) {
      layerBuffer = new Float32Array(instanceCount);
      // For billboards, we set layer based on some logic, here we just set to 0
      for (let i = 0; i < instanceCount; i++) {
        layerBuffer[i] = 0; // All use layer 0 for now
      }
      instancedGeometry.setAttribute(
        "instanceLayer",
        new InstancedBufferAttribute(layerBuffer, 1),
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
      "instanceHeight",
      new InstancedBufferAttribute(heightBuffer, 1),
    );
    instancedGeometry.setAttribute(
      "instanceShow",
      new InstancedBufferAttribute(showBuffer, 1),
    );
    instancedGeometry.setAttribute(
      "instanceColor",
      new InstancedBufferAttribute(colorBuffer, 3),
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
        scaleByDistance: m.material.scaleByDistance ?? true,
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

      if (positionsInfo.RTE) {
        mutates.updateRteUniforms(
          camera.position.x,
          camera.position.y,
          camera.position.z,
          enhancer.states(),
        );
      }
    };

    // Set custom program cache key and onBeforeCompile
    material.customProgramCacheKey = enhancer.programCacheKey;
    material.onBeforeCompile = enhancer.transformShader;

    // Handle billboard texture
    if (isBillboard && m.material.url) {
      await this.uploadTexture(m.material.url, material);
    }

    material.visible = m.material.show ?? true;
    return material;
  }

  private extractPositions(
    m: NavaraPointMesh | NavaraBillboardMesh,
    buf: BufferLoader,
  ): PositionsInfo | null {
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

  /** Extract raw RGBA pixel data from an image-based texture via an offscreen canvas. */
  private async extractPixelData(
    texture: { image: HTMLImageElement | ImageBitmap },
    flipY: boolean,
  ) {
    const img = texture.image;

    const imageData = await getImageDataFromImageBitmap(
      await createImageBitmap(img, {
        imageOrientation: flipY ? "flipY" : "none",
      }),
      new OffscreenCanvas(img.width, img.height),
    );

    return new Uint8Array(imageData);
  }

  private async uploadTexture(
    url: string,
    material: ShaderMaterial,
  ): Promise<number | undefined> {
    if (this._loadedUrls.has(url)) return [...this._loadedUrls].indexOf(url);

    const newTexture = await TEXTURE_LOADER.loadAsync(url);

    if (newTexture) {
      let newTextureArray: DataArrayTexture;
      const width = newTexture.image.width;
      const height = newTexture.image.height;
      const pixelData = await this.extractPixelData(newTexture, true);

      const existingTextureArray = material.uniforms.uTexture
        ?.value as DataArrayTexture;
      if (existingTextureArray) {
        // make sure new texture has same dimensions as existing one, otherwise we cannot update the texture array
        if (
          existingTextureArray.image.width !== width ||
          existingTextureArray.image.height !== height
        ) {
          console.warn(
            `InstancedSpriteMesh: Billboard texture size mismatch old:[${existingTextureArray.image.width}x${existingTextureArray.image.height}] ,new:[${width}x${height}], cannot update texture array`,
          );
          newTexture.dispose();
          return undefined;
        }
        // update existing texture array with new texture data
        const existingData = existingTextureArray.image.data as Uint8Array;
        const totalByteLength = existingData.byteLength + pixelData.byteLength;
        const textureData = new Uint8Array(totalByteLength);
        textureData.set(existingData, 0); // copy existing layers
        textureData.set(pixelData, existingData.byteLength); // append new layer

        newTextureArray = new DataArrayTexture(
          textureData,
          width,
          height,
          this._loadedUrls.size + 1,
        );

        existingTextureArray.dispose(); // dispose old texture array
      } else {
        newTextureArray = new DataArrayTexture(pixelData, width, height, 1);
      }

      newTextureArray.format = RGBAFormat;
      newTextureArray.type = UnsignedByteType;
      newTextureArray.generateMipmaps = false;
      newTextureArray.needsUpdate = true;
      newTextureArray.minFilter = LinearFilter;
      newTextureArray.magFilter = LinearFilter;

      // Sync texture and aspect ratio via enhancer
      this.getEnhancer().update({
        base: {
          texture: { value: newTextureArray },
          aspect: width / height,
        },
      });

      newTexture.dispose();
      this._loadedUrls.add(url);
      return this._loadedUrls.size - 1; // return index of the newly added texture layer
    }

    console.warn(`Failed to load texture from url: ${url}`);
    return undefined;
  }

  _setPickable(pickable: boolean): void {
    this.getEnhancer().update({ base: { pickable } });
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

    const showAttr = this.geometry.getAttribute(
      "instanceShow",
    ) as InstancedBufferAttribute;
    showAttr.setX(instanceId, rawVisible ? 1.0 : 0.0);
    showAttr.needsUpdate = true;
  }

  setFeatureHeightByBatchId(batchId: number, height: number) {
    const instanceId = this._batchIdToInstance.get(batchId);
    if (instanceId === undefined) return;

    const heightAttr = this.geometry.getAttribute(
      "instanceHeight",
    ) as InstancedBufferAttribute;
    heightAttr.setX(instanceId, height);
    heightAttr.needsUpdate = true;
  }

  dispose(): void {
    // Clean up SelectiveEffect registry links
    unlinkEffects(
      this,
      this._viewContext.selectiveEffectRegistry,
      this._layerId,
      this._prevEffectIds,
    );
    this._prevEffectIds = undefined;

    this.geometry?.dispose();

    const shaderMaterial = this.material as ShaderMaterial;

    const uniforms = shaderMaterial.uniforms as {
      uTexture?: { value: DataArrayTexture | null };
      [key: string]: unknown;
    };

    const textureArray = uniforms?.uTexture?.value;
    if (textureArray instanceof DataArrayTexture) {
      textureArray.dispose();
    }

    shaderMaterial.dispose();

    // Clear internal collections to release references
    this._batchIdToInstance.clear();
    this._loadedUrls.clear();
  }
}
