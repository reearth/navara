// Interface for EffectIds Buffer rendering mesh.
export type EffectIdsMesh = {
  _setEffectIdsMode(enabled: boolean, mask: number): void;
  _getEffectIds(): readonly string[];
};

export const isEffectIdsMesh = (v: object): v is EffectIdsMesh => {
  return (
    "_setEffectIdsMode" in v &&
    typeof (v as EffectIdsMesh)._setEffectIdsMode === "function" &&
    "_getEffectIds" in v &&
    typeof (v as EffectIdsMesh)._getEffectIds === "function"
  );
};
