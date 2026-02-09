import ThreeView, {
    AmbientLightLayer,
    Color,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addCtrlPanel, type MaterialLayerDescription } from "../../helpers/panel";


const layers: MaterialLayerDescription[] = [
    {
        type: "mvt",
        data: {
            url: VECTOR_DATASETS.gsiExperimentalVector.url,
        },
        point: {
            size: 10000,
            scaleByDistance: false,
            clampToGround: true,
            color: new Color().setStyle("#991f3d"),
            center: { x: 1.0, y: -1.0 },
            height: 1,
            offsetDepth: true,
            depthTest: true,
            transparent: true,
        },
        // billboard: {
        //     color: new Color().setStyle("#ffffff"),
        //     size: 10000,
        //     height: 1,
        //     scaleByDistance: false,
        //     clampToGround: true,
        //     depthTest: true,
        //     alphaTest: .5,
        //     center: { x: 1.0, y: -1.0 },
        //     transparent: true,
        //     url: "/sample.png",
        //     offsetDepth: true,
        // },
        vectorTile: {
            maxZoom: 4,
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

    view.addLayer({
        type: "tiles",
        data: { url: TILE_DATASETS.openstreetmap.url },
        rasterTile: {
            maxZoom: 23,
        },
    });

    const pane = new Pane({
        title: "Parameters",
        expanded: true,
    });

    addCtrlPanel(layers, view, pane);
    addCameraControl(view, pane);
    addDateControl(view, pane);
};