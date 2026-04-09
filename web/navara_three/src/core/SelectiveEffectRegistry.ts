// ============================================================================
// Constants
// ============================================================================

/** Effect key for Bloom selective effect */
export const SELECTIVE_BLOOM_EFFECT_KEY = "selectiveBloom" as const;

/** Effect key for Outline selective effect */
export const SELECTIVE_OUTLINE_EFFECT_KEY = "selectiveOutline" as const;

// ============================================================================
// SelectiveEffectRegistry
// ============================================================================

const MAX_SLOTS = 8;

/**
 * Unified registry for selective effects.
 *
 * Manages two mappings:
 * - **effectId → effectKey**: Resolves which effect type (e.g. "selectiveBloom") an ID refers to.
 * - **effectId → slot bit**: Assigns bit positions in the EffectIds Buffer bitmask (R channel).
 *   8 slots fit within a single 8-bit channel, compatible with both UnsignedByte and HalfFloat RTs.
 *   Freed slots are reused by subsequent registrations.
 */
export class SelectiveEffectRegistry {
  // effectId → effectKey mapping
  private effectKeys = new Map<string, string>();

  // effectId → slot bit mapping
  private idToSlot = new Map<string, number>();
  private freedSlots: number[] = [];
  private nextSlot = 0;

  /** Called when slot assignments change (register/unregister). */
  onSlotsChanged?: () => void;

  // ---------------------------------------------------------------------------
  // Effect key management
  // ---------------------------------------------------------------------------

  registerEffectKey(effectId: string, effectKey: string): void {
    this.effectKeys.set(effectId, effectKey);
  }

  unregisterEffectKey(effectId: string): void {
    this.effectKeys.delete(effectId);
  }

  // ---------------------------------------------------------------------------
  // Slot management
  // ---------------------------------------------------------------------------

  registerSlot(effectId: string): number {
    const existing = this.idToSlot.get(effectId);
    if (existing !== undefined) return existing;

    let slot: number;
    const freed = this.freedSlots.pop();
    if (freed !== undefined) {
      slot = freed;
    } else {
      if (this.nextSlot >= MAX_SLOTS) {
        console.warn(
          `SelectiveEffectRegistry: max ${MAX_SLOTS} slots reached, ignoring effectId "${effectId}"`,
        );
        return -1;
      }
      slot = this.nextSlot++;
    }

    this.idToSlot.set(effectId, slot);
    this.onSlotsChanged?.();
    return slot;
  }

  unregisterSlot(effectId: string): void {
    const slot = this.idToSlot.get(effectId);
    if (slot === undefined) return;
    this.idToSlot.delete(effectId);
    this.freedSlots.push(slot);
    this.onSlotsChanged?.();
  }

  get slotCount(): number {
    return this.idToSlot.size;
  }

  getSlot(effectId: string): number | undefined {
    return this.idToSlot.get(effectId);
  }

  computeMask(effectIds: readonly string[]): number {
    let mask = 0;
    for (const id of effectIds) {
      const slot = this.idToSlot.get(id);
      if (slot !== undefined && slot >= 0) {
        mask |= 1 << slot;
      }
    }
    return mask;
  }

  clear(): void {
    this.effectKeys.clear();
    this.idToSlot.clear();
    this.freedSlots = [];
    this.nextSlot = 0;
  }
}
