import type ThreeView from "@navara/three";
import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { InputBindingApi, Pane } from "tweakpane";

dayjs.extend(utc);
dayjs.extend(timezone);

export const DEFAULT_TIME_ZONE = "Asia/Tokyo";

// Returns a new Date set to `hours:minutes` wall-clock time in the given IANA
// zone, on the same calendar day the input falls on in that zone. DST
// transitions are handled by the dayjs timezone plugin.
export const atZoneTime = (
  date: Date,
  hours: number,
  minutes = 0,
  zone: string = DEFAULT_TIME_ZONE,
): Date =>
  dayjs(date).tz(zone).hour(hours).minute(minutes).startOf("minute").toDate();

export const addDateControl = (
  view: ThreeView,
  pane: Pane,
  initialDate?: Date,
  zone: string = DEFAULT_TIME_ZONE,
) => {
  let dt: Dayjs = dayjs(initialDate ?? new Date()).tz(zone);
  if (!initialDate) dt = dt.hour(8).startOf("hour");

  const apply = (next: Dayjs) => {
    dt = next;
    view.atmosphere.date = dt.toDate();
  };
  apply(dt);

  const PARAMS = {
    year: dt.year(),
    month: dt.month() + 1,
    hour: dt.hour(),
    minutesOfDay: dt.hour() * 60 + dt.minute(),
    animation: false,
  };

  const folder = pane.addFolder({ title: "Date" });

  folder
    .addBinding(PARAMS, "year", { min: 1900, max: PARAMS.year, step: 1 })
    .on("change", (v) => apply(dt.year(v.value)));
  folder
    .addBinding(PARAMS, "month", { min: 1, max: 12, step: 1 })
    .on("change", (v) => apply(dt.month(v.value - 1)));
  folder
    .addBinding(PARAMS, "hour", { min: 0, max: 23, step: 1 })
    .on("change", (v) => apply(dt.hour(v.value)));

  const maxMinutesOfDay = 24 * 60;
  const minutesOfDay = folder
    .addBinding(PARAMS, "minutesOfDay", {
      min: 0,
      max: maxMinutesOfDay,
      step: 1,
    })
    .on("change", (v) =>
      apply(dt.hour(Math.floor(v.value / 60)).minute(v.value % 60)),
    );
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

export const addCameraControl = (
  view: ThreeView,
  pane: Pane,
  addButton?: () => void,
) => {
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
        lng: 139.7511145474829,
        lat: 35.67364356091717,
        height: 902.0,
        heading: 64.41840149763287,
        pitch: -36.00000121921312,
        roll: 0,
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

  addButton?.();

  let rotationAnimationId: number;
  pane.addBinding({ autoRotation: false }, "autoRotation").on("change", (v) => {
    if (!v.value) {
      cancelAnimationFrame(rotationAnimationId);
      return;
    }

    const animateFunc = () => {
      view.rotateAround(0.002);
      rotationAnimationId = requestAnimationFrame(animateFunc);
    };
    animateFunc();
  });
};

export const addHidePaneKeyShortcut = (pane: Pane) => {
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  // Hide the pane for taking a screenshot.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    pane.element.style.display =
      pane.element.style.display === "none" ? "block" : "none";
  });
};
