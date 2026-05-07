// DOM component factories for the overlay-marker example.

export function injectGlobalStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes marker-pulse {
      0%   { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
      100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export function createOverlayContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.id = "overlay-container";
  container.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none; overflow: hidden; z-index: 10;
  `;
  document.body.appendChild(container);
  return container;
}

export function createMarkerElement(
  id: string,
  name: string,
): { root: HTMLElement; distanceLabel: HTMLElement } {
  const template = document.createElement("template");
  template.innerHTML = `
    <div id="marker-${id}" style="
      position: absolute; top: 0; left: 0;
      display: none; pointer-events: auto; cursor: pointer;
    ">
      <div style="position: relative; width: 0; height: 0;">
        <!-- Pulse ring -->
        <div style="
          position: absolute; top: 0; left: 0;
          width: 12px; height: 12px; border-radius: 50%;
          background: rgba(0,229,255,0.4);
          transform: translate(-50%,-50%);
          animation: marker-pulse 2s ease-out infinite;
        "></div>
        <!-- Center dot -->
        <div style="
          position: absolute; top: 0; left: 0;
          width: 10px; height: 10px; border-radius: 50%;
          background: #00e5ff;
          transform: translate(-50%,-50%);
          box-shadow: 0 0 6px 2px rgba(0,229,255,0.6),
                      0 0 12px 4px rgba(0,229,255,0.3);
        "></div>
      </div>

      <!-- Name label -->
      <div style="
        position: absolute; left: 0; top: 10px;
        transform: translateX(-50%); white-space: nowrap;
        font: 600 11px/1 ui-monospace, Menlo, monospace;
        letter-spacing: 0.08em; text-transform: uppercase;
        color: #fff;
        text-shadow: 0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.6);
        pointer-events: none;
      ">${name}</div>

      <!-- Distance label -->
      <div data-role="distance" style="
        position: absolute; left: 0; top: 24px;
        transform: translateX(-50%); white-space: nowrap;
        font: 400 9px/1 ui-monospace, Menlo, monospace;
        letter-spacing: 0.05em;
        color: rgba(255,255,255,0.6);
        text-shadow: 0 1px 3px rgba(0,0,0,0.7);
        pointer-events: none;
      "></div>
    </div>
  `.trim();

  const firstChild = template.content.firstElementChild;
  if (!firstChild) {
    throw new Error(`Failed to create marker element for id: ${id}`);
  }
  const root = firstChild.cloneNode(true) as HTMLElement;

  const distanceLabel = root.querySelector<HTMLElement>(
    '[data-role="distance"]',
  );
  if (!distanceLabel) {
    throw new Error(`Failed to find distance label in marker: ${id}`);
  }

  return { root, distanceLabel };
}

export function createHud(): HTMLDivElement {
  const hud = document.createElement("div");
  hud.style.cssText = `
    position: fixed; bottom: 16px; left: 16px; z-index: 20;
    font: 12px/1.6 system-ui, sans-serif;
    color: #fff; background: rgba(0,0,0,0.6);
    padding: 12px 16px; border-radius: 8px;
  `;
  hud.innerHTML = `
    <strong>Controls</strong><br>
    W/S: Forward / Backward<br>
    A/D: Turn Left / Right<br>
    Arrow Up/Down: Climb / Descend<br>
    Shift: Dash (2.5x speed)<br>
    Alt: Orbit Camera<br>
    Click marker: Teleport
  `.trim();
  document.body.appendChild(hud);
  return hud;
}

export function createAttribution(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed; bottom: 16px; right: 16px; z-index: 20;
    font: 10px system-ui, sans-serif;
    color: #ccc; background: rgba(0,0,0,0.5);
    padding: 4px 8px; border-radius: 4px;
  `;
  el.innerHTML = `Bird model:
    <a href="https://sketchfab.com/3d-models/animated-bird-pigeon-797d27b68af3453e865149435df6aa30"
       target="_blank" style="color:#8af;">dudecon</a> (CC-BY-4.0)`;
  document.body.appendChild(el);
  return el;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}
