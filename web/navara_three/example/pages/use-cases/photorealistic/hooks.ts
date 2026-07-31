import type ThreeView from "@navaramap/three";
import type { DefaultPlugin } from "@navaramap/three-default-plugin";
import { useEffect, useRef, useState } from "react";

type DefaultLayers = ReturnType<DefaultPlugin["addDefaultPhotorealScene"]>;

export function useDefaultLayers(
  view: ThreeView | null,
  plugin?: DefaultPlugin,
) {
  const initialized = useRef(false);
  const [defaultLayers, setDefaultLayers] = useState<DefaultLayers | null>(
    null,
  );

  // Mutating the imperative ThreeView engine object inside an effect is
  // intentional interop, not a render-phase mutation.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (!view || !plugin || initialized.current) return;
    initialized.current = true;
    // eslint-disable-next-line react-hooks/immutability
    view.toneMappingExposure = 10;
    const layers = plugin.addDefaultPhotorealScene();
    setDefaultLayers(layers);
  }, [view, plugin]);

  useEffect(() => {
    defaultLayers?.sky.delete();
    defaultLayers?.aerialPerspective.update({
      aerialPerspective: {
        sky: true,
      },
    });
  }, [defaultLayers]);

  return defaultLayers;
}
