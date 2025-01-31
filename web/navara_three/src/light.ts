import type { Vector3 } from "three";

export type Light = {
  ambient?: {
    enabled?: boolean;
    color?: number;
    intensity?: number;
  };
  sun?: {
    enabled?: boolean;
    color?: number;
    position?: Vector3;
    intensity?: number;
  };
};
