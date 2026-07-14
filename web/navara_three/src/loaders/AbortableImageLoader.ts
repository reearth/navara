import { Loader } from "three";

function createElementNS(name: string) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}

/** Same shape as a fetch abort rejection: `err.name === "AbortError"`. */
function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
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

    // Report the timeout before aborting: abort() dispatches its event
    // synchronously, so the reverse order would let the fallback path's
    // abort listener settle the load as AbortError first and swallow the
    // TimeoutError.
    const timeoutId = window.setTimeout(() => {
      fail(new Error("TimeoutError"));
      abort?.abort();
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

    // Before any async work, so every done/fail (which call itemEnd) has a
    // matching itemStart even when the fetch itself rejects or times out.
    scope.manager.itemStart(url);

    fetch(url, { signal: abort?.signal })
      .then((r) => r.blob())
      .then((blob) => {
        if (settled) {
          return;
        }
        if (abort?.signal.aborted) {
          fail(abortError(), true);
          return;
        }

        if (typeof createImageBitmap === "function") {
          // Decodes off the main thread and needs no object URL.
          // - flipY is baked in (see LoadedImage);
          // - premultiply disabled and colorSpaceConversion "none" so the
          //   decoded bytes match the old <img> → texImage2D path, where
          //   three sets UNPACK_PREMULTIPLY_ALPHA/UNPACK_COLORSPACE_CONVERSION
          //   to NONE (critical for RGB-encoded elevation fragments, whose
          //   bytes must not be color-managed before the shader decodes them).
          createImageBitmap(blob, {
            imageOrientation: "flipY",
            premultiplyAlpha: "none",
            colorSpaceConversion: "none",
          })
            .then((bitmap) => {
              // createImageBitmap cannot be cancelled; if the load already
              // settled (abort/timeout) while it was decoding, just release
              // the now-useless bitmap.
              if (settled || abort?.signal.aborted) {
                bitmap.close();
                if (!settled) fail(abortError(), true);
                return;
              }
              done(bitmap);
            })
            .catch((e) => fail(e));
          // Settle promptly on abort instead of blocking itemEnd (and any
          // loads gated on it) until the un-cancellable decode finishes. The
          // decode still runs; its .then closes the orphaned bitmap above.
          abort?.signal.addEventListener(
            "abort",
            () => fail(abortError(), true),
            { once: true },
          );
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
    if (abort?.signal.aborted) {
      fail(abortError(), true);
      return;
    }

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
      fail(abortError(), true);
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
