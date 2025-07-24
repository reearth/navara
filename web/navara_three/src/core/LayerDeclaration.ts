import { EventHandler } from "@navara/core";
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
> extends EventHandler<LayerDeclarationEvents> {
  public readonly id: string;
  public readonly sort?: number;

  protected view: ViewContext;
  protected _instance: Instance | null = null;

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
      if (this.instance) {
        this.instance.visible = updates.visible;
      }
    }
  }

  abstract onDestroy(): void;

  get visible() {
    return !!this._visible;
  }

  set visible(v: boolean) {
    this._visible = v;
    this.onUpdateConfig({ visible: v } as UpdateConfig);
  }

  get instance(): Instance | null {
    return this._instance;
  }

  set instance(v: Instance | null) {
    this._instance = v;
  }
}
