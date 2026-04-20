import {
  BaseDesc,
  BaseHandle,
  MeshDesc,
  LightDesc,
  EffectDesc,
  Layer as NavaraLayer,
  type LayerDescription,
  type MeshConfig,
  type LightConfig,
  type EffectConfig,
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

function useDeclarationLayer<L extends BaseDesc>(
  addFn: (config: Record<string, unknown>) => BaseHandle<L>,
  config: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: BaseHandle<L>) => (() => void) | void,
) {
  const handleRef = useRef<BaseHandle<L> | null>(null);
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

type MeshLayerProps<L extends MeshDesc = MeshDesc> = {
  config: MeshConfig;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: BaseHandle<L>) => (() => void) | void;
};

export function MeshLayer<L extends MeshDesc = MeshDesc>({
  config,
  onReady,
}: PropsWithChildren<MeshLayerProps<L>>) {
  const { view } = useViewContext();
  useDeclarationLayer<L>(
    (c) => view.addMesh<L>(c as MeshConfig),
    config as Record<string, unknown>,
    onReady,
  );
  return null;
}

type LightLayerProps<L extends LightDesc = LightDesc> = {
  config: LightConfig;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: BaseHandle<L>) => (() => void) | void;
};

export function LightLayer<L extends LightDesc = LightDesc>({
  config,
  onReady,
}: PropsWithChildren<LightLayerProps<L>>) {
  const { view } = useViewContext();
  useDeclarationLayer<L>(
    (c) => view.addLight<L>(c as LightConfig),
    config as Record<string, unknown>,
    onReady,
  );
  return null;
}

type EffectLayerProps<L extends EffectDesc = EffectDesc> = {
  config: EffectConfig | BuiltInEffectDescription;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: BaseHandle<L>) => (() => void) | void;
};

export function EffectLayer<L extends EffectDesc = EffectDesc>({
  config,
  onReady,
}: PropsWithChildren<EffectLayerProps<L>>) {
  const { view } = useViewContext();
  useDeclarationLayer<L>(
    (c) => view.addEffect<L>(c as EffectConfig | BuiltInEffectDescription),
    config as Record<string, unknown>,
    onReady,
  );
  return null;
}
