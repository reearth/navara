export const DEFAULT_FONT_URL = "/fonts/notosansjp/NotoSansJP[wght].ttf";
export { FontManager, createSdfAtlasTexture } from "./FontManager";
export { FontWorkerClient } from "./FontWorkerClient";
export { LRUMap } from "./LRUMap";
export type {
  FontAtlasData,
  GlyphMetrics,
  ShapedGlyph,
  ShapeTextResult,
} from "./FontManager";
