import { useViewContext } from "@navara/three_react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC,
  type PropsWithChildren,
} from "react";

export type NightContextValues = {
  isNight: boolean;
};

const NightContext = createContext<NightContextValues | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useNightContext = () => {
  const ctx = useContext(NightContext);
  if (!ctx) {
    throw new Error(
      "Navara React Error: You have to invoke this hook inside of NightProvider.",
    );
  }
  return ctx;
};

export const NightProvider: FC<PropsWithChildren> = ({ children }) => {
  const { view } = useViewContext();
  const [isNight, setIsNight] = useState(false);

  // Keep `isNight` in sync with atmosphere sun/camera
  useEffect(() => {
    if (!view) return;

    const update = () => {
      try {
        setIsNight(view.atmosphere.isAtNight(view.camera.raw.position));
      } catch {
        // noop
      }
    };

    view.atmosphere.on("sunChanged", update);
    view.camera.on("moveend", update);
    update();

    return () => {
      view.atmosphere.off("sunChanged", update);
      view.camera.off("moveend", update);
    };
  }, [view]);

  const value = useMemo<NightContextValues>(() => ({ isNight }), [isNight]);

  return (
    <NightContext.Provider value={value}>{children}</NightContext.Provider>
  );
};
