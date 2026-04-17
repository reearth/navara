import ThreeView, {
  type Plugin,
  type Options,
  type Declarations,
  type EmptyDeclarations,
} from "@navara/three";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
  type PropsWithChildren,
  type RefObject,
} from "react";

type ViewContextValues<D extends Declarations = EmptyDeclarations> = {
  view?: ThreeView<D>;
};

const ViewContext = createContext<ViewContextValues | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useViewContext = <
  D extends Declarations = EmptyDeclarations,
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
  const viewRef = useRef<ThreeView | undefined>(undefined);
  viewRef.current = view;

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
