#if defined(USE_BATCH_SHOW)
// Discard fragment if show is false (0.0)
if (nvr_vShow < 0.5) {
    discard;
}
#endif
