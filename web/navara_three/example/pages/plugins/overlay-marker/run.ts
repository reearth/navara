import ThreeView from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import {
  FlyingModelPlugin,
  OverlayPlugin,
  moveOverlayElement,
} from "@navara/three_plugins";

import {
  injectGlobalStyles,
  createOverlayContainer,
  createMarkerElement,
  createHud,
  createAttribution,
  formatDistance,
} from "./components";
import { JAPAN_LANDMARKS } from "./data/landmarks";

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  // Register plugins before init
  const defaultPlugin = new DefaultPlugin();
  const flyingModelPlugin = new FlyingModelPlugin({
    modelUrl: "/glTF/animated_bird_pigeon/scene.gltf",
    animation: {
      idleClip: "BirdRig|Gliding",
      dashClip: "BirdRig|Flapping",
      speed: 1.0,
      crossfadeDuration: 0.3,
    },
    modelRotationOffset: { x: -Math.PI / 2, y: 0, z: Math.PI },
    modelScale: 3,
  });
  const overlayPlugin = new OverlayPlugin({ maxDistance: 100_000 });

  view.addPlugin(defaultPlugin);
  view.addPlugin(flyingModelPlugin);
  view.addPlugin(overlayPlugin);

  await view.init();

  view.animation = true;

  // Scene setup
  view.atmosphere.date.setHours(8);
  view.toneMappingExposure = 10;

  const defaultScene = defaultPlugin.addDefaultPhotorealScene();
  defaultScene.aerialPerspective.update({
    aerialPerspective: {
      sky: true,
      irradiance: true,
    },
  });

  view.addEffect({
    clouds: {
      coverage: 0.2,
    },
  });

  // Google 3D Tiles
  const googleApiKey = import.meta.env.NAVARA_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    view.addLayer({
      type: "cesium3dtiles",
      data: {
        url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${googleApiKey}`,
      },
      model: {
        maxSse: 60,
      },
    });
  }

  // Set overlay positions from landmark data
  overlayPlugin.setPositions(
    JAPAN_LANDMARKS.map((l) => ({
      id: l.id,
      lng: l.lng,
      lat: l.lat,
      alt: l.alt,
    })),
  );

  // Build overlay DOM
  injectGlobalStyles();
  const overlayContainer = createOverlayContainer();

  const elementById = new Map<string, HTMLElement>();
  const distanceLabelById = new Map<string, HTMLElement>();

  for (const landmark of JAPAN_LANDMARKS) {
    const { root, distanceLabel } = createMarkerElement(
      landmark.id,
      landmark.name,
    );

    root.addEventListener("click", () => {
      flyingModelPlugin.teleport(landmark.lng, landmark.lat, landmark.alt);
    });

    overlayContainer.appendChild(root);
    elementById.set(landmark.id, root);
    distanceLabelById.set(landmark.id, distanceLabel);
  }

  // Update overlay positions every frame
  overlayPlugin.onUpdate(({ projected }) => {
    for (const [id, el] of elementById) {
      const pos = projected.get(id);
      if (pos) {
        el.style.display = "";
        moveOverlayElement(el, pos.x, pos.y);

        const opacity = Math.max(0.3, 1 - pos.distance / 100_000);
        el.style.opacity = String(opacity);

        const distLabel = distanceLabelById.get(id);
        if (distLabel) {
          distLabel.textContent = formatDistance(pos.distance);
        }
      } else {
        el.style.display = "none";
      }
    }
  });

  // Start flight
  flyingModelPlugin.start();

  createHud();
  createAttribution();
};
