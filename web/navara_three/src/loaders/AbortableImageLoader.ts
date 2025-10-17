import { Loader } from "three";

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
    onError?: (err: unknown, isAborted?: boolean) => void,
    abort?: AbortController,
    timeout = 5000,
  ): HTMLImageElement {
    if (this.path !== undefined) url = this.path + url;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scope = this;

    const timeoutId = window.setTimeout(() => {
      abort?.abort();
      onImageError(new Error("TimeoutError"));
    }, timeout);

    const image = createElementNS("img") as HTMLImageElement;
    function onImageLoad(this: any) {
      removeEventListeners();

      if (onLoad) onLoad(this);

      scope.manager.itemEnd(url);
    }
    function removeEventListeners() {
      image.removeEventListener("load", onImageLoad, false);
      image.removeEventListener("error", onImageError, false);
      abort?.signal.removeEventListener("abort", onAbort, false);
      window.clearTimeout(timeoutId);
    }
    function onImageError(event: unknown, isAborted?: boolean) {
      removeEventListeners();

      if (onError) onError(event, isAborted);

      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    }

    function onAbort() {
      // Abort a request by image element.
      image.src = "";
      image.remove();
    }
    if (abort) {
      abort.signal.onabort = onAbort;
    }

    fetch(url, { signal: abort?.signal })
      .then((r) => r.blob())
      .then((blob) => {
        if (abort?.signal.aborted) {
          return;
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
      .catch((e) => {
        onImageError(e, !e.name || e.name === "AbortError");
        removeEventListeners();
      });

    return image;
  }
}
