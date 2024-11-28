import { Cache, Loader } from "three";

function createElementNS(name: string) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}

// Ref: https://github.com/mrdoob/three.js/blob/beab9e845f9e5ae11d648f55b24a0e910b56a85a/src/loaders/ImageLoader.js
export class AbortableImageLoader extends Loader<HTMLImageElement> {
  loadAsyncWithAbort(
    url: string,
    abort?: AbortController,
    onProgress?: (event: ProgressEvent) => void,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scope = this;

    return new Promise<HTMLImageElement>(function (resolve, reject) {
      scope.load(url, resolve, onProgress, reject, abort);
    });
  }

  load(
    url: string,
    onLoad: (data: HTMLImageElement) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
    abort?: AbortController,
  ): HTMLImageElement {
    if (this.path !== undefined) url = this.path + url;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scope = this;

    const cached = Cache.get(url);

    if (cached !== undefined) {
      scope.manager.itemStart(url);

      setTimeout(function () {
        if (onLoad) onLoad(cached);

        scope.manager.itemEnd(url);
      }, 0);

      return cached;
    }

    const image = createElementNS("img") as HTMLImageElement;
    function onImageLoad(this: any) {
      removeEventListeners();

      Cache.add(url, this);

      if (onLoad) onLoad(this);

      scope.manager.itemEnd(url);
    }
    function removeEventListeners() {
      image.removeEventListener("load", onImageLoad, false);
      image.removeEventListener("error", onImageError, false);
      abort?.signal.removeEventListener("abort", onAbort, false);
    }
    function onImageError(event: unknown) {
      removeEventListeners();

      if (onError) onError(event);

      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    }

    function onAbort() {
      // Abort a request by image element.
      image.src = "";
      image.remove();
    }

    fetch(url, { signal: abort?.signal })
      .then((r) => r.blob())
      .then((blob) => {
        if (abort?.signal.aborted) {
          return;
        }

        if (abort) {
          abort.signal.onabort = onAbort;
        }

        image.addEventListener("load", onImageLoad, false);
        image.addEventListener("error", onImageError, false);

        if (url.slice(0, 5) !== "data:") {
          if (this.crossOrigin !== undefined)
            image.crossOrigin = this.crossOrigin;
        }

        scope.manager.itemStart(url);

        image.src = window.URL.createObjectURL(blob);
      })
      .catch(() => {
        removeEventListeners();
      });

    return image;
  }
}
