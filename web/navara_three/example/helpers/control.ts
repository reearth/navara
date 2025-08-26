import type ThreeView from "@navara/three";
import { Vector3 } from "three";
import type { InputBindingApi, Pane } from "tweakpane";

export const addDateControl = (view: ThreeView, pane: Pane) => {
  const date = new Date();
  date.setHours(8);

  view.atmosphere.date = date;

  const hour = date.getHours();

  const PARAMS = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    hour: date.getHours(),
    minutesOfDay: hour * 60,
    animation: false,
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

  const updateMinutesOfDay = (value: number) => {
    date.setHours(Math.floor(value / 60));
    date.setMinutes(value % 60);
    onChangeDate();
  };
  const maxMinutesOfDay = 24 * 60;
  const minutesOfDay = folder
    .addBinding(PARAMS, "minutesOfDay", {
      min: 0,
      max: maxMinutesOfDay,
      step: 1,
    })
    .on("change", (v) => {
      updateMinutesOfDay(v.value);
    });
  let animationId: number | undefined;
  folder.addBinding(PARAMS, "animation").on("change", (v) => {
    if (!v.value) {
      animationId && cancelAnimationFrame(animationId);
      return;
    }
    const run = () => {
      const value = minutesOfDay.controller
        .value as InputBindingApi<number>["controller"]["value"];
      value.rawValue += 1;
      if (value.rawValue >= maxMinutesOfDay) {
        value.rawValue = 0;
      }
      animationId = requestAnimationFrame(run);
    };
    run();
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

  pane
    .addButton({
      title: "Fuji view",
    })
    .on("click", () => {
      view.setCamera({
        lng: 138.7306518555,
        lat: 35.272277832,
        height: 30000,
        heading: 0,
        pitch: -70,
        roll: 0,
      });
    });

  let rotationAnimationId: number;
  pane.addBinding({ autoRotation: false }, "autoRotation").on("change", (v) => {
    if (!v.value) {
      cancelAnimationFrame(rotationAnimationId);
      return;
    }

    const animateFunc = () => {
      view.rotateAroundAxis(new Vector3(0, 0, 0), 0.002);
      rotationAnimationId = requestAnimationFrame(animateFunc);
    };
    animateFunc();
  });
};

export const addHidePaneKeyShortcut = (pane: Pane) => {
  // Hide the pane for taking a screenshot.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    pane.element.style.display =
      pane.element.style.display === "none" ? "block" : "none";
  });
};
