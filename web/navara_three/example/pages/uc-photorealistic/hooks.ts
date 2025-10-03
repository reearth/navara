import ThreeView, { Layer, type TilesLayer } from "@navara/three";
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
    atmosphere.sun.update({ sun: { castShadow: true } });
    setDefaultLayers({ effects, atmosphere });
  }, [view]);

  return defaultLayers;
}

export function useCloudOverlayOpacity(
  view: ThreeView | null,
  layerHandle: Layer | null,
  description: TilesLayer,
  targetHeight = 35e6,
) {
  useEffect(() => {
    if (!view || !layerHandle) return;

    const onMove = () => {
      const pos = view.camera.getPosition();
      const rt = description.raster_tile;
      if (!pos?.height || !rt) return;
      const opacity = Math.min(1, pos.height / targetHeight);
      rt.opacity = opacity;
      layerHandle.update({ ...description });
    };

    view.camera.on("move", onMove);
    view.camera.on("moveend", onMove);
    // initialize once
    onMove();
    return () => {
      view.camera.off("move", onMove);
      view.camera.off("moveend", onMove);
    };
  }, [view, layerHandle, description, targetHeight]);
}
