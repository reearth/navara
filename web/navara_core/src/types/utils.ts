export type Nullable<T> = T | null | undefined;

export type RemoveFreeRecursively<T> = T extends { free: unknown }
  ? {
      [K in keyof T as K extends "free" | symbol | number
        ? never
        : K]: RemoveFreeRecursively<T[K]>;
    }
  : T;

// wasm-bindgen generate a getter and setter, so need to extract it as a property.
export type ExtractProperties<T> = {
  [K in keyof T]?: T[K] extends (...args: any) => any
    ? ReturnType<T[K]> extends (...args: any) => any
      ? ExtractProperties<ReturnType<T[K]>>
      : ReturnType<T[K]>
    : Partial<T[K]>;
};

export type NormalizeWASMClass<C> = ExtractProperties<RemoveFreeRecursively<C>>;
