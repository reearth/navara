import type { Core } from "map-engine-prototype";

export function registerInputEvents(core: Core, element: HTMLElement): () => void {
  const mousedown = (event: MouseEvent) => {
    core.input({
      type: "mousedown",
      button: event.button,
    });
  };

  const mouseup = (event: MouseEvent) => {
    core.input({
      type: "mouseup",
      button: event.button,
    });
  };

  const mousemove = (event: MouseEvent) => {
    const width = element.clientWidth;
    const height = element.clientHeight;
    core.input({
      type: "mousemove",
      x: event.clientX / width,
      y: event.clientY / height,
    });
  };

  const wheel = (event: WheelEvent) => {
    core.input({
      type: "wheel",
      x: event.deltaX,
      y: event.deltaY,
    });
  };

  element.addEventListener("mousedown", mousedown);
  element.addEventListener("mouseup", mouseup);
  element.addEventListener("mousemove", mousemove);
  element.addEventListener("wheel", wheel);

  return () => {
    element.removeEventListener("mousedown", mousedown);
    element.removeEventListener("mouseup", mouseup);
    element.removeEventListener("mousemove", mousemove);
    element.removeEventListener("wheel", wheel);
  };
}
