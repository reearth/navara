import ThreeView, {
    AmbientLightLayer,
    Color,
    Layer,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS, MVT_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addCtrlPanel, type MaterialLayerDescription } from "../../helpers/panel";
import isNumber from "lodash-es/isNumber";


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
        // point: {
        //     size: 1000,
        //     scaleByDistance: true,
        //     clampToGround: true,
        //     color: new Color().setStyle("#991f3d"),
        //     height: 1,
        // },
        billboard: {
            color: new Color().setStyle("#ffffff"),
            size: 1000,
            height: 1,
            scaleByDistance: true,
            clampToGround: true,
            depthTest: true,
            alphaTest: .5,
            center: { x: 0.5, y: 0.5 },
            transparent: false,
            url: "/example.png",
            offsetDepth: false,
        },
        vectorTile: {
            maxZoom: 4,
        },
    }
];

let gLayer: Layer;

export const run = async (view: ThreeView) => {
    await view.init();

    view.setCamera({
        lng: 135.2876307211,
        lat: 34.0681032412,
        height: 44412.93,
        heading: 8.3733205871,
        pitch:-73.2083324309,
        roll: 360,
    });

    view.addLayer<AmbientLightLayer>({
        type: "light",
        ambient: {
            intensity: 0.5,
        },
    });

    view.addLayer({
        type: "tiles",
        data: { url: TILE_DATASETS.openstreetmap.url },
        rasterTile: {
            maxZoom: 23,
        },
    });

    // gLayer = view.addLayer({
    //     type: "mvt",
    //     data: {
    //         url: VECTOR_DATASETS.gsiExperimentalVector.url,
    //     },
    //     point: {
    //         size: 0.01,
    //         scaleByDistance: true,
    //         clampToGround: true,
    //         color: new Color().setStyle("#2d169c"),
    //     },
    //     // billboard: {
    //     //     color: new Color().setStyle("#ffffff"),
    //     //     size: 0.05,
    //     //     height: 1,
    //     //     scaleByDistance: true,
    //     //     clampToGround: true,
    //     //     depthTest: true,
    //     //     transparent: false,
    //     //     url: "/example.png",
    //     //     offsetDepth: false,

    //     // },
    //     vectorTile: {
    //         maxZoom: 23,
    //         layers: ["symbol", "label"],
    //     },
    // });

    // gLayer = view.addLayer({
    //     type: "mvt",
    //     data: {
    //         url: MVT_DATASETS.plateauWakayamaGen.url,
    //     },
    //     point: {
    //         size: 0.01,
    //         scaleByDistance: true,
    //         clampToGround: true,
    //         color: new Color().setStyle("#2d169c"),
    //     },
    // });

    const pane = new Pane({
        title: "Parameters",
        expanded: true,
    });

    addCtrlPanel(layers, view, pane);

    addCameraControl(view, pane);
    // registerLayerUpdate(view);
    addDateControl(view, pane);
};
// let pickedBatchIds: Set<number> = new Set();

// function registerLayerUpdate(view: ThreeView) {
//     if (!gLayer) return;

//     view.on("pick", (info) => {
//         if (info && isNumber(info.batchId)) {
//             pickedBatchIds.add(info.batchId);
//             gLayer.forceUpdate();
//         } else {
//             pickedBatchIds.clear();
//         }
//         console.log(pickedBatchIds);
//     });

//     gLayer.on("featureUpdated", ({ evaluator }) => {
//         evaluator.evaluate((batchId, property) => {
//             if (pickedBatchIds.has(batchId)) {
//                 console.log("pick color");
//                 return { color: new Color().setHex(0xff0000) }
//             }
//             else {
//                 console.log("default color")
//                 return { color: new Color().setHex(0x2d169c) }
//             }
//         });
//     });
// }