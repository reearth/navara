import { EventHandler, type BaseEventMap } from "@navara/core";
import { generateId } from "navara_wasm";

import type { ViewContext } from "./ViewContext";

export type LayerDeclarationConfig = {
  id?: string;
  visible?: boolean;
  sort?: number;
};

export type LayerDeclarationConfigUpdate = Pick<
  LayerDeclarationConfig,
  "visible"
>;

export type BaseInstance = { visible: boolean };

export type LayerDeclarationEvents = {
  _needsUpdate: () => void;
};

export abstract class LayerDeclaration<
  Config extends LayerDeclarationConfig = LayerDeclarationConfig,
  UpdateConfig extends
    LayerDeclarationConfigUpdate = LayerDeclarationConfigUpdate,
  Instance extends BaseInstance = BaseInstance,
  CustomEvent extends BaseEventMap = BaseEventMap,
> extends EventHandler<LayerDeclarationEvents & CustomEvent> {
  public readonly id: string;
  public readonly sort?: number;

  protected view: ViewContext;
  protected _instance: Instance | undefined;

  private _visible?: boolean;

  constructor(view: ViewContext, config: Config = {} as Config) {
    super();

    this.id = config.id || generateId();
    this.sort = config.sort;
    this._visible = config.visible ?? true;
    this.view = view;
  }

  abstract onCreate(): void;

  onUpdateConfig(updates: UpdateConfig) {
    if (updates.visible !== undefined) {
      this._visible = updates.visible;
      if (this._instance) {
        this._instance.visible = updates.visible;
      }
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.emit("_needsUpdate");
  }

  onDestroy(): void {
    this._instance = undefined;
  }

  get visible() {
    return !!this._visible;
  }

  set visible(v: boolean) {
    this._visible = v;
    this.onUpdateConfig({ visible: v } as UpdateConfig);
  }
}
