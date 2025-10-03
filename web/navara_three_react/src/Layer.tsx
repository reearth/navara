import {
  LayerDeclaration,
  LayerHandle,
  Layer as NavaraLayer,
  type LayerDescription,
} from "@navara/three";
import { useEffect, useRef } from "react";

import { useViewContext } from "./ViewContext";

type LH<L> = L extends LayerDeclaration ? LayerHandle<L> : NavaraLayer;

type Props<L> = {
  config: LayerDescription;
  onReady?: (handle: LH<L>) => void;
};

export function Layer<L = NavaraLayer>({ config, onReady }: Props<L>) {
  const { view } = useViewContext();

  const handleRef = useRef<LH<L> | null>(null);

  useEffect(() => {
    const handle = view.addLayer(config) as LH<L>;
    handleRef.current = handle;
    onReady?.(handle);
    return () => {
      // Unmount: remove layer
      handle.delete();
      handleRef.current = null;
    };
  }, [view, config, onReady]);

  useEffect(() => {
    // Update when config changes
    if (handleRef.current) {
      handleRef.current.update(config as never);
    }
  }, [config]);

  return null;
}
