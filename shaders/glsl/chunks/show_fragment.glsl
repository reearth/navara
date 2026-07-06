#ifdef USE_BATCH_COLOR_SHOW
// nvr_vShow contains show bit (0 or 1) from COLOR_SHOW alpha channel
// nvr_vOpacity contains opacity (0.0-1.0, 7-bit precision)
// Alpha channel uses bit packing: bit 7 = show, bits 0-6 = opacity
// Discard if show bit is false (0)
if (nvr_vShow < 0.5) {
    discard;
}
#endif
