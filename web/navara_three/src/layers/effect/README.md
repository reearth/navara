# Core Effect Descriptors

This module contains only core effect descriptors that are tightly coupled with the
internal rendering pipeline (MRT passes, transparent pass, final copy, selective
effects).

Independent, self-contained effect descriptors should be implemented as external
packages (e.g., `@navara/three_default_descs`) using the public
`EffectDesc` API and registered via plugins.
