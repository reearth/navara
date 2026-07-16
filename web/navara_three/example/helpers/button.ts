/**
 * Plain DOM buttons for the curated gallery examples (pages/examples/*).
 *
 * Gallery demos keep their on-map UI to a few minimal buttons that match the
 * neutral basemap, instead of a Tweakpane panel (Tweakpane stays on the
 * dev/debug pages). Buttons stack in a fixed bar at the top-left corner.
 *
 * The returned element is a plain HTMLButtonElement: reflect state from the
 * example by assigning `textContent`, `disabled` and `onclick` directly, so
 * the example code stays free of styling concerns.
 */

const BUTTON_BAR_CLASS = "example-button-bar";
const BUTTON_CLASS = "example-button";

const BUTTON_CSS = `
.${BUTTON_BAR_CLASS} {
  position: fixed;
  top: 16px;
  left: 16px;
  display: flex;
  gap: 8px;
  font-family: system-ui, sans-serif;
}
.${BUTTON_CLASS} {
  padding: 8px 14px;
  font-size: 13px;
  color: #333;
  background: #fff;
  border: 1px solid #d4d7da;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  cursor: pointer;
}
.${BUTTON_CLASS}:hover:not(:disabled) {
  background: #f5f6f7;
}
.${BUTTON_CLASS}:disabled {
  opacity: 0.5;
  cursor: default;
}
`;

let buttonBar: HTMLDivElement | undefined;

const ensureButtonBar = (): HTMLDivElement => {
  if (buttonBar) return buttonBar;
  const style = document.createElement("style");
  style.textContent = BUTTON_CSS;
  document.head.appendChild(style);
  buttonBar = document.createElement("div");
  buttonBar.className = BUTTON_BAR_CLASS;
  document.body.appendChild(buttonBar);
  return buttonBar;
};

/**
 * Appends a styled button to the shared top-left button bar and returns it.
 * The bar and its stylesheet are created on the first call.
 */
export const addButton = (
  label: string,
  onClick?: () => void,
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = BUTTON_CLASS;
  button.textContent = label;
  if (onClick) button.onclick = onClick;
  ensureButtonBar().appendChild(button);
  return button;
};
