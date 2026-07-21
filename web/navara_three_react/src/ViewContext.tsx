import ThreeView from "@navaramap/three";
import type {
  Plugin,
  Options,
  Descriptions,
  EmptyDescriptions,
} from "@navaramap/three";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { FC, PropsWithChildren, RefObject } from "react";

type ViewContextValues<D extends Descriptions = EmptyDescriptions> = {
  view?: ThreeView<D>;
};

const ViewContext = createContext<ViewContextValues | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useViewContext = <
  D extends Descriptions = EmptyDescriptions,
>() => {
  const ctx = useContext(ViewContext);
  if (!ctx) {
    throw new Error(
      "Navara React Error: You have to invoke this hook inside of ViewProvider.",
    );
  }

  return ctx as Required<ViewContextValues<D>>;
};

export type ViewProviderProps = {
  canvas?: HTMLCanvasElement | RefObject<HTMLCanvasElement>;
  plugins?: Plugin[];
} & Options;

export const ViewProvider: FC<PropsWithChildren<ViewProviderProps>> = ({
  canvas,
  children,
  plugins,
  ...opts
}) => {
  const [view, setView] = useState<ThreeView | undefined>();
  const [isReady, setIsReady] = useState(false);
  // The ref is written when the view is created in the effect below; syncing it
  // during render is both redundant and disallowed by react-hooks/refs.
  const viewRef = useRef<ThreeView | undefined>(undefined);

  useEffect(() => {
    if (viewRef.current) {
      console.warn("You need to recreate ThreeView.");
      return;
    }

    const innerCanvas = canvas && "current" in canvas ? canvas.current : canvas;

    const v = new ThreeView({ canvas: innerCanvas, ...opts });
    if (plugins) {
      for (const plugin of plugins) {
        v.addPlugin(plugin);
      }
    }
    setView(v);
    viewRef.current = v;

    (async () => {
      try {
        await v.init();
        setIsReady(true);
      } catch (e) {
        console.error("Navara init failed:", e);
      }
    })();

    return () => {
      // TODO
      // v.dispose();
    };
  }, [canvas, opts, plugins]);

  return (
    <ViewContext.Provider value={{ view }}>
      {isReady ? children : null}
    </ViewContext.Provider>
  );
};
