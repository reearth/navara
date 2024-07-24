import type { Core } from "navara";

// TODO: Need to think about how to propagate these event to worker.
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

  const keydown = (event: KeyboardEvent) => {
    core.input({
      type: "keydown",
      key_code: event.code,
      key: event.key,
    });
  };

  const keyup = (event: KeyboardEvent) => {
    core.input({
      type: "keyup",
      key_code: event.code,
      key: event.key,
    });
  };

  element.addEventListener("mousedown", mousedown);
  element.addEventListener("mouseup", mouseup);
  element.addEventListener("mousemove", mousemove);
  element.addEventListener("wheel", wheel);
  document.addEventListener("keydown", keydown);
  document.addEventListener("keyup", keyup);

  return () => {
    element.removeEventListener("mousedown", mousedown);
    element.removeEventListener("mouseup", mouseup);
    element.removeEventListener("mousemove", mousemove);
    element.removeEventListener("wheel", wheel);
    document.removeEventListener("keydown", keydown);
    document.removeEventListener("keyup", keyup);
  };
}
