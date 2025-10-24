import ThreeView, { Layer } from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
// import { addCtrlPanel, type MaterialLayerDescription } from "../../helpers/panel";
// import { add } from "lodash-es";

// const geoLayersDef: MaterialLayerDescription[] = [
//     {
//         type: "cesium3dtiles",
//         data: { url: TILES_3D_DATASETS.YamanashiKyonaka.url },
//         model: {
//             show: true,
//         },
//     }
// ];
let gLayerVisible = true;

export const run = async (view: ThreeView) => {
    await view.init();

    view.addDefaultAtmosphereLayers();

    view.setCamera({
        lat: 35.4904441833,
        lng: 138.1674957275,
        height: 34945.88,
        heading: 53.2889709473,
        pitch: -49.3131942749,
        roll: 0.0,
    });

    view.addLayer({
        type: "tiles",
        data: { url: TILE_DATASETS.openstreetmap.url },
        raster_tile: {
            max_zoom: 23,
        },
    });

    const pntsLayer = view.addLayer({
        type: "cesium3dtiles",
        // data: { url: "https://raw.githubusercontent.com/adel-elmala/dummy-assets/refs/heads/main/dataset_0/tileset.json" },
        data: { url: TILES_3D_DATASETS.YamanashiKyonaka.url },
        model: {
            show: true,
        },
    });

    const pane = new Pane({
        title: "Parameters",
        expanded: true,
    });

    addCameraControl(view, pane);
    // addCtrlPanel(geoLayersDef, view, pane);
    addLayerControl(view, pane, pntsLayer);
    showAttributions([TILE_DATASETS.openstreetmap]);
};

const addCameraControl = (view: ThreeView, pane: Pane) => {
    pane
        .addButton({
            title: "Globe view",
        })
        .on("click", () => {
            view.flyTo({
                lng: 90,
                lat: 0.1,
                height: 12600000,
                heading: 0,
                pitch: -90,
                roll: 0,
            });
        });

    pane
        .addButton({
            title: "Yamanashi - Kyonaka view",
        })
        .on("click", () => {
            view.flyTo({
                lat: 35.4904441833,
                lng: 138.1674957275,
                height: 34945.88,
                heading: 53.2889709473,
                pitch: -49.3131942749,
                roll: 0.0,
            });
        });
};

const addLayerControl = (view: ThreeView, pane: Pane, layer: Layer) => {
    pane
        .addButton({
            title: "Delete Point Cloud Layer",
        })
        .on("click", () => {
            view.deleteLayerById(layer.id);
        });

    pane
        .addButton({
            title: "update Point Cloud Layer",
        })
        .on("click", () => {
            gLayerVisible = !gLayerVisible;
            view.updateLayerById(layer.id, {
                model: {
                    show: gLayerVisible,
                },
            });
        });
};


