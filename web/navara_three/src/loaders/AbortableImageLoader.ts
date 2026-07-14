import { Loader } from "three";

function createElementNS(name: string) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}

/**
 * Decoded tile image. `ImageBitmap` on browsers with `createImageBitmap`
 * (decode happens off the main thread); `HTMLImageElement` on the fallback
 * path. An `ImageBitmap` is produced with `imageOrientation: "flipY"`, so the
 * consumer must upload it with `texture.flipY = false` to match the
 * `<img>`-path orientation (the GL flip flag is ignored for ImageBitmap
 * uploads anyway).
 */
export type LoadedImage = HTMLImageElement | ImageBitmap;

// Ref: https://github.com/mrdoob/three.js/blob/beab9e845f9e5ae11d648f55b24a0e910b56a85a/src/loaders/ImageLoader.js
export class AbortableImageLoader extends Loader<LoadedImage> {
  loadAsyncWithAbort(
    url: string,
    abort?: AbortController,
    onProgress?: (event: ProgressEvent) => void,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scope = this;

    return new Promise<LoadedImage>(function (resolve, reject) {
      scope.load(url, resolve, onProgress, reject, abort);
    });
  }

  load(
    url: string,
    onLoad: (data: LoadedImage) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown, isAborted?: boolean) => void,
    abort?: AbortController,
    timeout = 5000,
  ): void {
    if (this.path !== undefined) url = this.path + url;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scope = this;

    let settled = false;

    const timeoutId = window.setTimeout(() => {
      abort?.abort();
      fail(new Error("TimeoutError"));
    }, timeout);

    function done(image: LoadedImage) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);

      onLoad(image);

      scope.manager.itemEnd(url);
    }

    function fail(err: unknown, isAborted?: boolean) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);

      if (onError) onError(err, isAborted);

      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    }

    fetch(url, { signal: abort?.signal })
      .then((r) => r.blob())
      .then((blob) => {
        if (abort?.signal.aborted || settled) {
          return;
        }

        scope.manager.itemStart(url);

        if (typeof createImageBitmap === "function") {
          // Decodes off the main thread and needs no object URL. flipY is
          // baked in (see LoadedImage) and premultiply is disabled to match
          // what the GL unpack flags do on the <img> path.
          createImageBitmap(blob, {
            imageOrientation: "flipY",
            premultiplyAlpha: "none",
          })
            .then((bitmap) => {
              if (settled || abort?.signal.aborted) {
                bitmap.close();
                return;
              }
              done(bitmap);
            })
            .catch((e) => fail(e));
          return;
        }

        this.loadViaImageElement(url, blob, done, fail, abort);
      })
      .catch((e) => {
        fail(e, !e.name || e.name === "AbortError");
      });
  }

  /**
   * Fallback for browsers without `createImageBitmap`. The object URL keeps
   * the blob alive until revoked, so it must be revoked on every exit path
   * (load, error, abort) or each fetched tile leaks its encoded bytes for the
   * page's lifetime.
   */
  private loadViaImageElement(
    url: string,
    blob: Blob,
    done: (image: LoadedImage) => void,
    fail: (err: unknown, isAborted?: boolean) => void,
    abort?: AbortController,
  ) {
    const objectUrl = window.URL.createObjectURL(blob);
    const image = createElementNS("img") as HTMLImageElement;

    function cleanup() {
      window.URL.revokeObjectURL(objectUrl);
      image.removeEventListener("load", onImageLoad, false);
      image.removeEventListener("error", onImageError, false);
      abort?.signal.removeEventListener("abort", onAbort, false);
    }

    function onImageLoad(this: HTMLImageElement) {
      cleanup();
      done(this);
    }

    function onImageError(event: unknown) {
      cleanup();
      fail(event);
    }

    function onAbort() {
      // Abort the decode by clearing the image element.
      image.src = "";
      image.remove();
      cleanup();
      fail(new Error("AbortError"), true);
    }

    image.addEventListener("load", onImageLoad, false);
    image.addEventListener("error", onImageError, false);
    abort?.signal.addEventListener("abort", onAbort, false);

    if (url.slice(0, 5) !== "data:") {
      if (this.crossOrigin !== undefined) image.crossOrigin = this.crossOrigin;
    }

    image.src = objectUrl;
  }
}
