import type { Texture } from "three";

// TODO: Provide an API to specify these settings for each material.
export type TextureOptions = {
  maxAnisotropy: number;
  minFilter: number;
  magFilter: number;
  useMipmaps: boolean;
  maxTextures: number;
  // Automatically tracked - which additional textures are in use
  additionalTexturesInUse?: {
    waterTexture?: boolean;
    colorMapTexture?: boolean;
  };
  // Shared water normal texture loaded once and shared across all meshes
  // This is set when waterTexture.enabled is true in Options
  sharedWaterTexture?: Texture;
};
