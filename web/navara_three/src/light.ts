export type Light = {
  ambient?: {
    enabled?: boolean;
    color?: number;
    intensity?: number;
  };
  sun?: {
    enabled?: boolean;
    color?: number;
    position?: [number, number, number];
    intensity?: number;
  };
};
