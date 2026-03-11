# Core Effect Layers

This module contains only core effect layers that are tightly coupled with the
internal rendering pipeline (MRT passes, transparent pass, final copy, selective
effects).

Independent, self-contained effect layers should be implemented as external
packages (e.g., `@navara/three_default_layers`) using the public
`EffectLayerDeclaration` API and registered via plugins.
