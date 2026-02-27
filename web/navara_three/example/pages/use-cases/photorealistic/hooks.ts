import ThreeView from "@navara/three";
import type { DefaultPlugin } from "@navara/three_default_plugin";
import { useEffect, useRef, useState } from "react";

type DefaultEffects = ReturnType<ThreeView["addDefaultEffectLayers"]>;
type DefaultAtmosphere = ReturnType<DefaultPlugin["addDefaultPhotorealLayers"]>;

export function useDefaultLayers(
  view: ThreeView | null,
  plugin?: DefaultPlugin,
) {
  const initialized = useRef(false);
  const [defaultLayers, setDefaultLayers] = useState<{
    effects: DefaultEffects;
    atmosphere: DefaultAtmosphere;
  } | null>(null);

  useEffect(() => {
    if (!view || !plugin || initialized.current) return;
    initialized.current = true;
    view.toneMappingExposure = 10;
    const effects = view.addDefaultEffectLayers();
    const atmosphere = plugin.addDefaultPhotorealLayers();
    setDefaultLayers({ effects, atmosphere });
  }, [view, plugin]);

  useEffect(() => {
    defaultLayers?.atmosphere.sky.delete();
    defaultLayers?.effects.aerialPerspective.update({
      aerialPerspective: {
        sky: true,
      },
    });
  }, [defaultLayers]);

  return defaultLayers;
}
