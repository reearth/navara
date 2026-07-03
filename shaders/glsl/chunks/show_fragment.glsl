#ifdef USE_BATCH_COLOR_SHOW
// nvr_vShow contains show * opacity (bundled in COLOR_SHOW alpha channel)
// Discard if show is false (nvr_vShow will be 0 when show=false)
// For opacity support: apply nvr_vShow to diffuseColor.a after this check
if (nvr_vShow < 0.001) {
    discard;
}
#endif
