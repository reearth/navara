import { Loader, Texture } from "three";

import { AbortableImageLoader } from "./AbortableImageLoader";

/**
 * Dispose a texture and release its backing image. When the texture is backed
 * by an `ImageBitmap` (the `createImageBitmap` decode path in
 * AbortableImageLoader), `texture.dispose()` frees the GL texture but NOT the
 * bitmap's decoded-pixel memory, which lives off-heap until `.close()` — so a
 * plain dispose leaks it on every tile removal. Safe for any texture: images
 * that are not ImageBitmaps (render targets, HTMLImageElement) are left alone.
 */
export function disposeTexture(texture: Texture): void {
  const image = texture.image as unknown;
  texture.dispose();
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    image.close();
  }
}

// Ref: https://github.com/mrdoob/three.js/blob/beab9e845f9e5ae11d648f55b24a0e910b56a85a/src/loaders/TextureLoader.js
export class AbortableTextureLoader extends Loader {
  loadAsyncWithAbort(
    url: string,
    abort?: AbortController,
    onProgress?: (event: ProgressEvent) => void,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scope = this;

    return new Promise<Texture>(function (resolve, reject) {
      scope.load(url, resolve, onProgress, reject, abort);
    });
  }

  load(
    url: string,
    onLoad: (data: Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown, isAborted?: boolean) => void,
    abort?: AbortController,
  ): Texture {
    const texture = new Texture();

    const loader = new AbortableImageLoader(this.manager);
    loader.setCrossOrigin(this.crossOrigin);
    loader.setPath(this.path);

    loader.load(
      url,
      function (image) {
        texture.image = image;
        if (
          typeof ImageBitmap !== "undefined" &&
          image instanceof ImageBitmap
        ) {
          // The bitmap is already flipped at decode time
          // (imageOrientation: "flipY" — see AbortableImageLoader).
          texture.flipY = false;
        }
        texture.needsUpdate = true;

        if (onLoad !== undefined) {
          onLoad(texture);
        }
      },
      onProgress,
      onError,
      abort,
    );

    return texture;
  }
}
