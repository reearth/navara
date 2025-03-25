declare module "troika-three-text" {
  import type {
    Color,
    Material,
    MeshBasicMaterial,
    MeshStandardMaterial,
  } from "three";
  import { Object3D } from "three";

  // Currently, we are only using blockBounds.
  // If other members are needed in the future, they should be added here.
  // ref:
  // https://github.com/protectwise/troika/blob/1abaf66d7a92cf347f12caa0fc41339af0cfef09/packages/troika-three-text/src/TextBuilder.js#L83-L108
  export interface TroikaTextRenderInfo {
    blockBounds: number[];
  }

  export class Text extends Object3D {
    constructor();

    text: string;
    fontSize: number;
    font: string;
    color: string | number | Material | Color;
    maxWidth: number;
    lineHeight: number;
    letterSpacing: number;
    textAlign: "left" | "right" | "center" | "justify";
    material: MeshBasicMaterial | MeshStandardMaterial;
    anchorX: "left" | "center" | "right" | string;
    anchorY: "top" | "middle" | "bottom" | "baseline" | string;
    clipRect: [number, number, number, number];
    depthOffset: number;
    direction: "auto" | "ltr" | "rtl";
    overflowWrap: "normal" | "break-word";
    whiteSpace: "normal" | "nowrap";
    outlineWidth: number;
    outlineOffsetX: number;
    outlineOffsetY: number;
    outlineColor: string | number;
    outlineOpacity: number;
    strokeWidth: number;
    strokeColor: string | number | Color;
    strokeOpacity: number;
    curveRadius: number;
    fillOpacity: number;
    fontStyle: "normal" | "italic";
    fontWeight: "normal" | "bold";
    glyphGeometryDetail: number;
    gpuAccelerateSDF: boolean;
    outlineBlur: number;
    sdfGlyphSize: number;
    textIndent: number;
    unicodeFontsUrl: string;
    textRenderInfo: TroikaTextRenderInfo;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
