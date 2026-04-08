/**
 * Extract a single bit from a float bitmask.
 * Used by selective effect passes (Bloom, Outline) to check if an effect slot is active.
 *
 * @param maskValue - Float bitmask from EffectIds buffer (R channel)
 * @param bitIndex - Bit position to check (0-7)
 * @return 1.0 if the bit is set, 0.0 otherwise
 */
float extractEffectBit(float maskValue, int bitIndex) {
  return mod(floor(maskValue / exp2(float(bitIndex))), 2.0);
}
