import ThreeView from "@navara/three";
import { useEffect, useRef, useState } from "react";

type DefaultEffects = ReturnType<ThreeView["addDefaultEffectLayers"]>;
type DefaultAtmosphere = ReturnType<ThreeView["addDefaultAtmosphereLayers"]>;

export function useDefaultLayers(view: ThreeView | null) {
  const initialized = useRef(false);
  const [defaultLayers, setDefaultLayers] = useState<{
    effects: DefaultEffects;
    atmosphere: DefaultAtmosphere;
  } | null>(null);

  useEffect(() => {
    if (!view || initialized.current) return;
    initialized.current = true;
    view.toneMappingExposure = 10;
    const effects = view.addDefaultEffectLayers();
    const atmosphere = view.addDefaultAtmosphereLayers();
    setDefaultLayers({ effects, atmosphere });
  }, [view]);

  useEffect(() => {
    defaultLayers?.atmosphere?.sky.update({
      sky: {},
      visible: false,
    });
  }, [defaultLayers]);

  return defaultLayers;
}
