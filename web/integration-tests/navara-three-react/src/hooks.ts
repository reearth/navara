import ThreeView from "@navara/three";
import type { DefaultPlugin } from "@navara/three_default_plugin";
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

  useEffect(() => {
    if (!view || !plugin || initialized.current) return;
    initialized.current = true;
    view.toneMappingExposure = 10;
    const layers = plugin.addDefaultPhotorealScene();
    layers.sun.update({ sun: { castShadow: true } });
    setDefaultLayers(layers);
  }, [view, plugin]);

  return defaultLayers;
}
