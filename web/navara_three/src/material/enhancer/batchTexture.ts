export type BatchTextureFlags = {
  useBatchTexture?: boolean;
  useBatchColorShow?: boolean; // Note: opacity is bundled with show in COLOR_SHOW's alpha channel
  useBatchHeight?: boolean;
  useBatchExtrudedHeight?: boolean;
  useBatchLineWidth?: boolean;
  useBatchSize?: boolean;
};
