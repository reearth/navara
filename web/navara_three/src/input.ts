import type { Core } from "@navara/engine";

// TODO: Need to think about how to propagate these event to worker.
export function registerInputEvents(
  core: Core,
  element: HTMLElement,
): () => void {
  let mouseEvent:
    | {
        type: "mousedown" | "mouseup";
        button: number;
      }
    | undefined;
  const mousedown = (event: MouseEvent) => {
    mouseEvent = {
      type: "mousedown",
      button: event.button,
    };
    core.input(mouseEvent);
  };
  const mouseup = () => {
    core.input({
      ...(mouseEvent ?? {}),
      type: "mouseup",
    });
    mouseEvent = undefined;
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
      key_code: event?.code,
      key: event?.key,
    });
  };
  // This is used to emit a key up event without any params.
  const keyupEmpty = () => {
    core.input({
      type: "keyup",
    });
  };

  element.addEventListener("mousedown", mousedown);
  element.addEventListener("mouseup", mouseup);
  element.addEventListener("mouseleave", mouseup);
  element.addEventListener("mouseleave", keyupEmpty);
  element.addEventListener("mousemove", mousemove);
  element.addEventListener("wheel", wheel);
  document.addEventListener("keydown", keydown);
  document.addEventListener("keyup", keyup);

  return () => {
    element.removeEventListener("mousedown", mousedown);
    element.removeEventListener("mouseup", mouseup);
    element.removeEventListener("mouseleave", mouseup);
    element.removeEventListener("mouseleave", keyupEmpty);
    element.removeEventListener("mousemove", mousemove);
    element.removeEventListener("wheel", wheel);
    document.removeEventListener("keydown", keydown);
    document.removeEventListener("keyup", keyup);
  };
}
