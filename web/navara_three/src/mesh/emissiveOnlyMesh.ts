// Interface for emissive-only rendering mesh (EmissiveBufferPass pattern).
export type EmissiveOnlyMesh = {
  _setEmissiveOnly(emissiveOnly: boolean): void;
};

export const isEmissiveOnlyMesh = (v: object): v is EmissiveOnlyMesh => {
  return (
    "_setEmissiveOnly" in v &&
    typeof (v as EmissiveOnlyMesh)._setEmissiveOnly === "function"
  );
};
