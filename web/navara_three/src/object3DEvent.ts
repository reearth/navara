import type { Object3DEventMap } from "three";

export type CustomObject3DEventMap = Object3DEventMap & { removedFromWorld: undefined };
