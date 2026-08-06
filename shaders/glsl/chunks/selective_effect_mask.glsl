/**
 * Extract a single bit from a float bitmask.
 * Used by selective effect passes (Bloom, Outline) to check if an effect slot is active.
 *
 * @param maskValue - Float bitmask from EffectIds buffer (R channel)
 * @param bitIndex - Bit position to check (0-10)
 * @return 1.0 if the bit is set, 0.0 otherwise
 */
float extractEffectBit(float maskValue, int bitIndex) {
  // Integer bit test – exp2()/floor() is not exact on all drivers (e.g.
  // ANGLE Metal computes exp2(1.0) slightly above 2.0, so
  // floor(mask / exp2(bit)) drops the bit whenever the mask holds exactly
  // that slot's value). The mask is an integer ≤ 2047 stored in half float,
  // so round-trip through int is lossless.
  return float((int(maskValue + 0.5) >> bitIndex) & 1);
}
