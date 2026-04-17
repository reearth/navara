import {
  LayerDeclaration,
  LayerHandle,
  MeshLayerDeclaration,
  LightLayerDeclaration,
  EffectLayerDeclaration,
  Layer as NavaraLayer,
  type LayerDescription,
  type MeshLayerConfig,
  type LightLayerConfig,
  type EffectLayerConfig,
  type BuiltInEffectDescription,
} from "@navara/three";
import { useEffect, useRef, type PropsWithChildren } from "react";

import { useViewContext } from "./ViewContext";

type LayerProps = {
  config: LayerDescription;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: NavaraLayer) => (() => void) | void;
};

export function Layer({ config, onReady }: PropsWithChildren<LayerProps>) {
  const { view } = useViewContext();

  const handleRef = useRef<NavaraLayer | null>(null);

  const configRef = useRef(config);
  const onReadyRef = useRef(onReady);

  configRef.current = config;

  useEffect(() => {
    const handle = view.addLayer(configRef.current);
    handleRef.current = handle;
    const unmount = onReadyRef.current?.(handle);
    return () => {
      unmount?.();
      handle.delete();
      handleRef.current = null;
    };
  }, [view]);

  useEffect(() => {
    if (handleRef.current) {
      if ("data" in config) {
        const { data: _data, ...withoutData } = config;
        handleRef.current.update(withoutData);
      } else {
        handleRef.current.update(config);
      }
    }
  }, [config]);

  return null;
}

function useDeclarationLayer<L extends LayerDeclaration>(
  addFn: (config: Record<string, unknown>) => LayerHandle<L>,
  config: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: LayerHandle<L>) => (() => void) | void,
) {
  const handleRef = useRef<LayerHandle<L> | null>(null);
  const configRef = useRef(config);
  const onReadyRef = useRef(onReady);

  configRef.current = config;

  useEffect(() => {
    const handle = addFn(configRef.current);
    handleRef.current = handle;
    const unmount = onReadyRef.current?.(handle);
    return () => {
      unmount?.();
      handle.delete();
      handleRef.current = null;
    };
  }, [addFn]);

  useEffect(() => {
    if (handleRef.current) {
      handleRef.current.update(config as never);
    }
  }, [config]);
}

type MeshLayerProps<L extends MeshLayerDeclaration = MeshLayerDeclaration> = {
  config: MeshLayerConfig;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: LayerHandle<L>) => (() => void) | void;
};

export function MeshLayer<
  L extends MeshLayerDeclaration = MeshLayerDeclaration,
>({ config, onReady }: PropsWithChildren<MeshLayerProps<L>>) {
  const { view } = useViewContext();
  useDeclarationLayer<L>(
    (c) => view.addMesh<L>(c as MeshLayerConfig),
    config as Record<string, unknown>,
    onReady,
  );
  return null;
}

type LightLayerProps<L extends LightLayerDeclaration = LightLayerDeclaration> =
  {
    config: LightLayerConfig;
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    onReady?: (handle: LayerHandle<L>) => (() => void) | void;
  };

export function LightLayer<
  L extends LightLayerDeclaration = LightLayerDeclaration,
>({ config, onReady }: PropsWithChildren<LightLayerProps<L>>) {
  const { view } = useViewContext();
  useDeclarationLayer<L>(
    (c) => view.addLight<L>(c as LightLayerConfig),
    config as Record<string, unknown>,
    onReady,
  );
  return null;
}

type EffectLayerProps<
  L extends EffectLayerDeclaration = EffectLayerDeclaration,
> = {
  config: EffectLayerConfig | BuiltInEffectDescription;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: LayerHandle<L>) => (() => void) | void;
};

export function EffectLayer<
  L extends EffectLayerDeclaration = EffectLayerDeclaration,
>({ config, onReady }: PropsWithChildren<EffectLayerProps<L>>) {
  const { view } = useViewContext();
  useDeclarationLayer<L>(
    (c) => view.addEffect<L>(c as EffectLayerConfig | BuiltInEffectDescription),
    config as Record<string, unknown>,
    onReady,
  );
  return null;
}
