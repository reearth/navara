import ThreeView, {
  type Layer,
  type LayerHandle,
  type SelectiveBloomEffectLayer,
} from "@navara/three";

export type SelectiveEffects = {
  selectiveOutline: Layer;
  selectiveBloom: LayerHandle<SelectiveBloomEffectLayer>;
};

export const setupSelectiveEffects = (view: ThreeView): SelectiveEffects => {
  const selectiveOutline = view.addLayer({
    type: "effect",
    selectiveOutline: {
      color: 0xff0000,
      thickness: 2.0,
      edgeStrength: 1.0,
    },
    debugMask: false,
    resolutionScale: 1.0,
  });

  const selectiveBloom = view.addLayer<SelectiveBloomEffectLayer>({
    type: "effect",
    selectiveBloom: {
      strength: 0.1,
      radius: 0.5,
      threshold: 0.0,
      debugMode: 0,
    },
    debugMask: true,
    resolutionScale: 1.0,
  });

  view.addDefaultEffectLayers();

  return { selectiveOutline, selectiveBloom };
};
