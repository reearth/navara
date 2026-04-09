// ============================================================================
// SelectiveEffectRegistry
// ============================================================================

const MAX_SLOTS = 11;

/**
 * Unified registry for selective effects.
 *
 * Manages effectId → slot bit mapping.
 * Assigns bit positions in the EffectIds Buffer bitmask (R channel).
 * Half-float preserves integer masks up to 2047 exactly, so up to 11 slots
 * (2^11 - 1) can be represented losslessly in a single channel.
 * Freed slots are reused by subsequent registrations.
 */
export class SelectiveEffectRegistry {
  // effectId → slot bit mapping
  private idToSlot = new Map<string, number>();
  private freedSlots: number[] = [];
  private nextSlot = 0;

  /** Called when slot assignments change (register/unregister). */
  onSlotsChanged?: () => void;

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
    this.idToSlot.clear();
    this.freedSlots = [];
    this.nextSlot = 0;
  }
}
