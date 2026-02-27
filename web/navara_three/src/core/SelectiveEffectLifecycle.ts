import type { Object3D } from "three";

import type { SelectiveEffectHelper } from "./SelectiveEffectHelper";
import { unlinkEffects, updateEffectLinks } from "./SelectiveEffectHelper";
import { injectSelectiveEffectHandlers } from "./SelectiveEffectMaskContext";

/**
 * Object3D に紐づく Selective Effect のライフサイクルを管理する。
 * - mask-pass ハンドラの注入
 * - effectIds のレジストリ登録・更新
 * - dispose / removedFromWorld 時のクリーンアップ
 *
 * dispose() は冪等。removedFromWorld リスナーと mesh.dispose() の
 * 両方から呼んでも安全。
 */
export class SelectiveEffectLifecycle {
  private prevEffectIds?: string[];

  constructor(
    private readonly target: Object3D,
    private readonly registry: SelectiveEffectHelper | undefined,
    private readonly layerId: string,
  ) {
    // @ts-expect-error - removedFromWorld is a custom event defined in CustomObject3DEventMap
    target.addEventListener("removedFromWorld", () => {
      this.dispose();
    });
  }

  /** mask-pass ハンドラを onBeforeRender/onAfterRender に注入する */
  injectHandlers(): void {
    injectSelectiveEffectHandlers(this.target, {
      registry: this.registry,
      layerId: this.layerId,
    });
  }

  /** effectIds の変更をレジストリに反映する */
  update(effectIds: string[] | undefined): void {
    const updated = updateEffectLinks(
      this.target,
      this.registry,
      this.layerId,
      this.prevEffectIds,
      effectIds,
    );
    if (updated !== undefined) this.prevEffectIds = updated;
  }

  /**
   * レジストリからリンクを解除する。
   * removedFromWorld で自動呼出しされるが、mesh の dispose() からも
   * 明示的に呼べる。冪等（複数回呼んでも安全）。
   */
  dispose(): void {
    if (this.prevEffectIds === undefined) return;
    unlinkEffects(this.target, this.registry, this.layerId, this.prevEffectIds);
    this.prevEffectIds = undefined;
  }
}
