import ThreeView, { DepthOfFieldEffectLayer, DEFAULT_DEPTH_OF_FIELD_OPTIONS } from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { LOCAL_DATASETS, TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
import { addHidePaneKeyShortcut, addDateControl, addCameraControl } from "../../helpers/control";

export const run = async (view: ThreeView) => {
    await view.init();

    const defaultAtmospheres = view.addDefaultAtmosphereLayers();
    defaultAtmospheres.sun.update({
        sun: {
            intensity: 1,
            castShadow: true,
        },
    });

    const depthOfFieldDefaults = DEFAULT_DEPTH_OF_FIELD_OPTIONS;

    const depthOfFieldLayer = view.addLayer<DepthOfFieldEffectLayer>({
        type: "effect",
        depthOfField: { ...depthOfFieldDefaults },
        visible: true,
    });

    view.addLayer({
        type: "tiles",
        data: { url: TILE_DATASETS.openstreetmap.url },
        raster_tile: {
            max_zoom: 23,
        },
    });

    view.addLayer({
        type: "cesium3dtiles",
        data: {
            url: TILES_3D_DATASETS.plateauChiyoda.url,
        },
        model: {
            show: true,
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.1,
            cast_shadow: true,
            receive_shadow: true,
        },
    });

    view.addLayer({
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        coordinates: [127.7, 26.2],
                        type: "Point",
                    },
                },
            ],
        },
        model: {
            show: true,
            size: 200000,
            height: 0,
            clamp_to_ground: true,
            url: LOCAL_DATASETS.steelDrumGLTF.url,
            should_rotate_in_default: true,
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.1,
        },
    });

    const pane = new Pane({
        title: "Depth of Field Effect",
        expanded: true,
    });

    addHidePaneKeyShortcut(pane);

    const params = { ...depthOfFieldDefaults };

    pane.addBinding(params, "bokehScale", { min: 1.0, max: 5.0, step: 0.001 })
        .on("change", (ev) => {
            depthOfFieldLayer.update({ depthOfField: { bokehScale: ev.value } });
        });

    const coc = pane.addFolder({ title: "Circle of confusion", expanded: true });
    coc.addBinding(params, "focusDistance", { min: 0.0, max: 1.0, step: 0.001 })
        .on("change", (ev) => {
            depthOfFieldLayer.update({ depthOfField: { focusDistance: ev.value } });
        });

    // coc.addBinding(params, "focusRange", { min: 0.0, max: 1.0, step: 0.001 })
    //     .on("change", (ev) => {
    //         depthOfFieldLayer.update({ depthOfField: { focusRange: ev.value } });
    //     });

    coc.addBinding(params, "focalLength", { min: 0.0, max: 1.0, step: 0.0001 })
        .on("change", (ev) => {
            depthOfFieldLayer.update({ depthOfField: { focalLength: ev.value } });
        });

    pane.addButton({ title: "Reset" }).on("click", () => {
        Object.assign(params, depthOfFieldDefaults);
        pane.refresh();
        depthOfFieldLayer.update({ depthOfField: { ...depthOfFieldDefaults } });
    });

    addDateControl(view, pane);
    addCameraControl(view, pane);
    showAttributions([TILE_DATASETS.gsiSeamlessphoto]);
};
