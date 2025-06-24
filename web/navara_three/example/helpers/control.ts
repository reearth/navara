import type ThreeView from "@navara/three";
import type { Pane } from "tweakpane";

export const addDateControl = (view: ThreeView, pane: Pane) => {
  const date = new Date();
  date.setHours(8);

  view.atmosphere.date = date;

  const PARAMS = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    hour: date.getHours(),
  };

  const onChangeDate = () => {
    view.atmosphere.date = date;
  };

  const folder = pane.addFolder({
    title: "Date",
  });

  folder
    .addBinding(PARAMS, "year", {
      min: 1900,
      max: date.getFullYear(),
      step: 1,
    })
    .on("change", (v) => {
      date.setFullYear(v.value);
      onChangeDate();
    });
  folder
    .addBinding(PARAMS, "month", { min: 1, max: 12, step: 1 })
    .on("change", (v) => {
      date.setMonth(v.value - 1);
      onChangeDate();
    });
  folder
    .addBinding(PARAMS, "hour", { min: 0, max: 23, step: 1 })
    .on("change", (v) => {
      date.setHours(v.value);
      onChangeDate();
    });
};

export const addCameraControl = (view: ThreeView, pane: Pane) => {
  pane
    .addButton({
      title: "Globe view",
    })
    .on("click", () => {
      view.setCamera({
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
      title: "Tokyo view",
    })
    .on("click", () => {
      view.setCamera({
        lng: 139.75711454748298,
        lat: 35.67564356091717,
        height: 902.0,
        heading: 64.41840149763287, // -180 to 180
        pitch: -36.00000121921312, // -180 to 0
        roll: 0, // -180 to 180
      });
    });
};
