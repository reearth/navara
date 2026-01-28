import ThreeView, {
    AmbientLightLayer,
    Color,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS, MVT_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

export const run = async (view: ThreeView) => {
    await view.init();

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

    // view.addLayer({
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
    //         color: new Color().setStyle("#ffffff"),
    //         size: 0.1,
    //         height: 1,
    //         scaleByDistance: true,
    //         clampToGround: true,
    //         transparent: false,
    //         depthTest: true,
    //         offsetDepth: false,
    //     },
    // });

    view.addLayer({
        
        type: "mvt",
        data: {
            // Credit:
            // - 3D City Model (Project PLATEAU) Wakayama City (FY2023) - MLIT PLATEAU
            //   https://www.geospatial.jp/ckan/dataset/plateau-30201-wakayama-shi-2023
            // url: "https://assets.cms.plateau.reearth.io/assets/d4/ee889d-98b4-4425-a5b6-c60bf36e2e5a/30201_wakayama-shi_city_2023_citygml_1_op_gen_20_mvt_lod0/{z}/{x}/{y}.mvt",
            url : MVT_DATASETS.plateauTokyoFirePrevention.url
        },
        point: {
            show: true,
            color: new Color().setHex(0xff0000),
            size: 0.01,
            height: 1,
            center: {
                x: 0.5,
                y: 0,
            },
            scaleByDistance: false,
            clampToGround: false,
            depthTest: true,
        }
        
    });

    const pane = new Pane({
        title: "Parameters",
        expanded: true,
    });

    addCameraControl(view, pane);
    addDateControl(view, pane);
};