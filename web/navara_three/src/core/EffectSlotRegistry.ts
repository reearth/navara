const MAX_SLOTS = 11;

/**
 * Maps effect layer IDs (string UUIDs) to integer slot numbers (0-10).
 * Slot numbers correspond to bit positions in the EffectIds Buffer bitmask.
 * HalfFloat has 11 significant bits, so 11 slots (0-10) are supported.
 *
 * Slots are assigned on register() and freed on unregister().
 * Freed slots are reused by subsequent registrations.
 */
export class EffectSlotRegistry {
  private idToSlot = new Map<string, number>();
  private freedSlots: number[] = [];
  private nextSlot = 0;

  register(effectId: string): number {
    const existing = this.idToSlot.get(effectId);
    if (existing !== undefined) return existing;

    let slot: number;
    const freed = this.freedSlots.pop();
    if (freed !== undefined) {
      slot = freed;
    } else {
      if (this.nextSlot >= MAX_SLOTS) {
        console.warn(
          `EffectSlotRegistry: max ${MAX_SLOTS} slots reached, ignoring effectId "${effectId}"`,
        );
        return -1;
      }
      slot = this.nextSlot++;
    }

    this.idToSlot.set(effectId, slot);
    return slot;
  }

  unregister(effectId: string): void {
    const slot = this.idToSlot.get(effectId);
    if (slot === undefined) return;
    this.idToSlot.delete(effectId);
    this.freedSlots.push(slot);
  }

  get size(): number {
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
