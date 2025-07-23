import { generateId } from "navara_wasm";

import type { LayerView } from "./LayerView";

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

export abstract class LayerDeclaration<
  Config extends LayerDeclarationConfig = LayerDeclarationConfig,
  UpdateConfig extends
    LayerDeclarationConfigUpdate = LayerDeclarationConfigUpdate,
  Instance extends BaseInstance = BaseInstance,
> {
  public readonly id: string;
  public readonly sort?: number;

  protected view: LayerView;
  protected _instance: Instance | null = null;

  private _visible?: boolean;

  constructor(view: LayerView, config: Config = {} as Config) {
    this.id = config.id || generateId();
    this.sort = config.sort;
    this._visible = config.visible;
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
