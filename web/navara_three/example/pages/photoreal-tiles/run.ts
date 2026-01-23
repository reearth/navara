import ThreeView from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILES_3D_DATASETS } from "../../helpers/constants";
import { addDateControl, addCameraControl } from "../../helpers/control";

export const run = async (view: ThreeView) => {
  await view.init();

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  const layer = view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://tile.googleapis.com/v1/3dtiles/root.json?key=AIzaSyD2Jo_QHIP_4aCi3tnl72JNxCM5RRMrOZ8",
    },
    model: {
      maxSse: 60,
    },
  });

  const featuresCredit = new Map<bigint, string>();

  layer.on("featureCreated", ({ id, credit }) => {
    if (!credit) return;
    featuresCredit.set(id, credit);
    
    // let l = credit.split(";");
    // l.forEach(credit => credits.set(credit, credits.get(credit) + 1 || 1));
    // const attrib = document.getElementById("navara-attributions-content");
    // if (!attrib) return;
    // attrib.innerHTML = Array.from(credits.entries()).map(([credit, count]) => `${credit} (${count})`).join("<br>");
    console.log("Feature created. Current credit:", featuresCredit);
  });

  layer.on("featureRemoved", ({ id }) => {
    featuresCredit.delete(id);
    // if (!credit) return;
    // console.log("Feature removed with credit:", credit);
    // let l = credit.split(";");
    // l.forEach(credit => {
    //   let count = credits.get(credit);
    //   if (count) {
    //     count -= 1;
    //     if (count <= 0) {
    //       credits.delete(credit);
    //     } else {
    //       credits.set(credit, count);
    //     }
    //   }
    // });
    console.log("Feature removed. Current credits:", featuresCredit);
  });

  addCameraControl(view, pane);
  addDateControl(view, pane);
  showAttributions([TILES_3D_DATASETS.googlePhotorealTiles]);
};
