import ThreeView, { type AttributionSource } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import {
  PersonViewPlugin,
  OverlayPlugin,
  moveOverlayElement,
} from "@navaramap/three_plugins";

import { LOCAL_DATASETS, TILES_3D_DATASETS } from "../../../helpers/constants";
import { atZoneTime } from "../../../helpers/control";
import { GOOGLE_MAPS_API_KEY } from "../../../helpers/keys";

import {
  injectGlobalStyles,
  createOverlayContainer,
  createMarkerElement,
  createHud,
  formatDistance,
} from "./components";
import { JAPAN_LANDMARKS } from "./data/landmarks";

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  // Register plugins before init
  const defaultPlugin = new DefaultPlugin();
  const personViewPlugin = new PersonViewPlugin({
    character: {
      modelUrl: "/glTF/animated_bird_pigeon/scene.gltf",
      animation: {
        idleClip: "BirdRig|Gliding",
        dashClip: "BirdRig|Flapping",
        speed: 1.0,
        crossfadeDuration: 0.3,
      },
      modelRotationOffset: { x: -Math.PI / 2, y: 0, z: Math.PI },
      modelScale: 1,
    },
    cameraDistance: 20,
    cameraPitch: Math.PI * 0.12,
    fpvHeightOffset: 0,
    fpvForwardOffset: 0.1,
  });
  const overlayPlugin = new OverlayPlugin({ maxDistance: 100_000 });
  // Position (bottom-left) is set on the view via `defaultAttribution` in main.ts
  // so the ⓘ credit trigger clears this page's bottom-right HUD.
  const attribution = view.attribution;

  view.addPlugin(defaultPlugin);
  view.addPlugin(personViewPlugin);
  view.addPlugin(overlayPlugin);

  await view.init();

  view.animation = true;

  // Scene setup
  view.atmosphere.date = atZoneTime(view.atmosphere.date, 8);
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
  const googleApiKey = GOOGLE_MAPS_API_KEY;
  const sources: AttributionSource[] = [LOCAL_DATASETS.animatedBirdPigeonGLTF];
  if (googleApiKey) {
    const tilesLayer = view.addLayer({
      type: "cesium3dtiles",
      data: {
        url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(googleApiKey)}`,
      },
      model: {
        maxSse: 60,
        normals: true,
      },
    });
    // Per-tile credits nest under the Google source via `creditLayerId`.
    sources.unshift({
      ...TILES_3D_DATASETS.googlePhotorealTiles,
      creditLayerId: tilesLayer.id,
    });
  }
  attribution?.add(sources);

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
      personViewPlugin.teleport({
        lng: landmark.lng,
        lat: landmark.lat,
        alt: landmark.alt,
      });
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

  // Start person view
  personViewPlugin.start();

  createHud();
};
