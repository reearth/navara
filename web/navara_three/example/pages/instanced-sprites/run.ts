import ThreeView, {
    AmbientLightLayer,
    Color,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS, MVT_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addCtrlPanel, type MaterialLayerDescription } from "../../helpers/panel";


const layers: MaterialLayerDescription[] = [
    // {
    //     type: "geojson",
    //     data: {
    //         type: "FeatureCollection",
    //         features: [
    //             {
    //                 type: "Feature",
    //                 properties: {},
    //                 geometry: {
    //                     coordinates: [139.70513431449842, 35.69279782617761],
    //                     type: "Point",
    //                 },
    //             },
    //             {
    //                 type: "Feature",
    //                 properties: {},
    //                 geometry: {
    //                     coordinates: [140.13033810546995, 35.60447056434825],
    //                     type: "Point",
    //                 },
    //             },
    //             // {
    //             //     type: "Feature",
    //             //     properties: {},
    //             //     geometry: {
    //             //         coordinates: [139.64591330307843, 35.85950281451436],
    //             //         type: "Point",
    //             //     },
    //             // },
    //             // {
    //             //     type: "Feature",
    //             //     properties: {},
    //             //     geometry: {
    //             //         coordinates: [139.63564871528018, 35.44128807202607],
    //             //         type: "Point",
    //             //     },
    //             // },
    //             // // {
    //             // //     type: "Feature",
    //             // //     properties: {},
    //             // //     geometry: {
    //             // //         coordinates: [139.28453080888477, 35.51560883529815],
    //             // //         type: "Point",
    //             // //     },
    //             // // },
    //         ],
    //     },
    //     point: {
    //         color: new Color().setStyle("#283e9e"),
    //         size: 0.1,
    //         height: 1,
    //         scaleByDistance: true,
    //         clampToGround: true,
    //         transparent: false,
    //         depthTest: true,
    //         offsetDepth: false,
    //     },
    // },
    {
        type: "mvt",
        data: {
            url: VECTOR_DATASETS.gsiExperimentalVector.url,
        },
        point: {
          size: 0.01,
          scaleByDistance: true,
          clampToGround: true,
          color: new Color().setStyle("#40ff00"),
        },
        // billboard: {
        //     color: new Color().setStyle("#ffffff"),
        //     size: 0.05,
        //     height: 1,
        //     scaleByDistance: true,
        //     clampToGround: true,
        //     depthTest: true,
        //     transparent: false,
        //     url: "/example.png",
        //     offsetDepth: false,

        // },
        vectorTile: {
            maxZoom: 8,
            layers: ["symbol", "label"],
        },
    }
];

export const run = async (view: ThreeView) => {
    await view.init();

    view.addLayer<AmbientLightLayer>({
        type: "light",
        ambient: {
            intensity: 0.5,
        },
    });

    // view.addLayer({
    //     type: "tiles",
    //     data: { url: TILE_DATASETS.openstreetmap.url },
    //     rasterTile: {
    //         maxZoom: 23,
    //     },
    // });

    const pane = new Pane({
        title: "Parameters",
        expanded: true,
    });

    addCtrlPanel(layers, view, pane);

    addCameraControl(view, pane);
    addDateControl(view, pane);
};