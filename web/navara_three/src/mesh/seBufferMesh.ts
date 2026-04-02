// Interface for SE Buffer rendering mesh (unified EmissiveOnly + EffectIds).
export type SEBufferMesh = {
  _setSEBufferMode(enabled: boolean, effectIdsMask: number): void;
  _getEffectIds(): readonly string[];
};

export const isSEBufferMesh = (v: object): v is SEBufferMesh => {
  return (
    "_setSEBufferMode" in v &&
    typeof (v as SEBufferMesh)._setSEBufferMode === "function" &&
    "_getEffectIds" in v &&
    typeof (v as SEBufferMesh)._getEffectIds === "function"
  );
};
