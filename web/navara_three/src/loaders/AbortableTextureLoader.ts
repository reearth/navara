import { Loader, Texture } from "three";

import { AbortableImageLoader } from "./AbortableImageLoader";

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
    onError?: (err: unknown) => void,
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
