import ThreeView, { type Options } from "@navara/three";
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

type ViewContextValues<
  CustomLayerDescriptions extends
    | Record<string, unknown>
    | undefined = undefined,
> = {
  view?: ThreeView<CustomLayerDescriptions>;
};

const ViewContext = createContext<ViewContextValues | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useViewContext = <
  CustomLayerDescriptions extends
    | Record<string, unknown>
    | undefined = undefined,
>() => {
  const ctx = useContext(ViewContext);
  if (!ctx) {
    throw new Error(
      "Navara React Error: You have to invoke this hook inside of ViewProvider.",
    );
  }

  return ctx as Required<ViewContextValues<CustomLayerDescriptions>>;
};

export type ViewProviderProps = {
  canvas?: HTMLCanvasElement | RefObject<HTMLCanvasElement>;
} & Options;

export const ViewProvider: FC<PropsWithChildren<ViewProviderProps>> = ({
  canvas,
  children,
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
  }, [canvas, opts]);

  return (
    <ViewContext.Provider value={{ view }}>
      {isReady ? children : null}
    </ViewContext.Provider>
  );
};
