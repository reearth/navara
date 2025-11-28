import ThreeView, {
  type Layer,
  type LayerHandle,
  type PostEffectBloomEffectLayer,
} from "@navara/three";

export type PostEffects = {
  postEffectOutline: Layer;
  postEffectBloom: LayerHandle<PostEffectBloomEffectLayer>;
};

export const setupPostEffects = (view: ThreeView): PostEffects => {
  const postEffectOutline = view.addLayer({
    type: "effect",
    postEffectOutline: {
      color: 0xff0000,
      thickness: 2.0,
      edgeStrength: 1.0,
    },
    debugMask: false,
    resolutionScale: 1.0,
  });

  const postEffectBloom = view.addLayer<PostEffectBloomEffectLayer>({
    type: "effect",
    postEffectBloom: {
      strength: 0.1,
      radius: 0.5,
      threshold: 0.0,
      debugMode: 0,
    },
    debugMask: true,
    resolutionScale: 1.0,
  });

  view.addDefaultEffectLayers();

  return { postEffectOutline, postEffectBloom };
};
