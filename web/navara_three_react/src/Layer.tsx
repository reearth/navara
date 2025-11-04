import {
  LayerDeclaration,
  LayerHandle,
  Layer as NavaraLayer,
  type LayerDescription,
} from "@navara/three";
import { useEffect, useRef, type PropsWithChildren } from "react";

import { useViewContext } from "./ViewContext";

type LH<L> = L extends LayerDeclaration ? LayerHandle<L> : NavaraLayer;

type Props<L> = {
  config: LayerDescription;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onReady?: (handle: LH<L>) => (() => void) | void;
};

export function Layer<L = NavaraLayer>({
  config,
  onReady,
}: PropsWithChildren<Props<L>>) {
  const { view } = useViewContext();

  const handleRef = useRef<LH<L> | null>(null);

  const configRef = useRef(config);
  const onReadyRef = useRef(onReady);

  configRef.current = config;

  useEffect(() => {
    const handle = view.addLayer(configRef.current) as LH<L>;
    handleRef.current = handle;
    const unmount = onReadyRef.current?.(handle);
    return () => {
      // TODO: Support unmount in strict mode. Currently tile layer doesn't work well(order is confused).
      // Unmount: remove layer
      unmount?.();
      handle.delete();
      handleRef.current = null;
    };
  }, [view]);

  useEffect(() => {
    // Update when config changes
    if (handleRef.current) {
      handleRef.current.update(config);
    }
  }, [config]);

  return null;
}
