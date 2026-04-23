import ThreeView, { JAPAN_GSI_ELEVATION_DECODER, Color } from "@navara/three";
import { CloudsEffectDesc } from "@navara/three_default_descs";
import type {
  ArclineMeshDesc,
  SmoothLineMeshDesc,
} from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Vector3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

const gArcLinesDef = [
  {
    // Asia
    thickness: 2,
    segments: 64,
    height: 0,
    arcHeightScale: 0.3,
    transparent: false,
    opacity: 1,
    srcColor: new Color().setHex(0xffffff),
    tgtColor: new Color().setHex(Math.floor(Math.random() * 0xffffff)),
    gradation: 0,
    dashed: false,
    dashSize: 200000,
    dashOffset: 0,
    gapSize: 200000,
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 126.44, lat: 37.4633 }, // ICN

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 121.232, lat: 25.0775 }, // TPE

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 113.9185, lat: 22.308 }, // HKG

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 103.994, lat: 1.354 }, // SIN

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 55.3644, lat: 25.2528 }, // DXB

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 72.8777, lat: 19.0896 }, // BOM

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 77.1025, lat: 28.5562 }, // DEL
    ],
  },
  {
    // Oceania
    srcColor: new Color().setHex(0xffffff),
    tgtColor: new Color().setHex(Math.floor(Math.random() * 0xffffff)),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 151.1772, lat: -33.9461 }, // SYD

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 151.837, lat: -27.3842 }, // BNE

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 144.8433, lat: -37.669 }, // MEL
    ],
  },
  {
    // Europe
    srcColor: new Color().setHex(0xffffff),
    tgtColor: new Color().setHex(Math.floor(Math.random() * 0xffffff)),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -0.4543, lat: 51.4706 }, // LHR

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 2.55, lat: 49.0128 }, // CDG

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 37.9063, lat: 55.9726 }, // SVO
    ],
  },
  {
    // North America
    srcColor: new Color().setHex(0xffffff),
    tgtColor: new Color().setHex(Math.floor(Math.random() * 0xffffff)),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -118.4085, lat: 33.9416 }, // LAX

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -122.375, lat: 37.6188 }, // SFO

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -74.0059, lat: 40.6413 }, // JFK
    ],
  },
  {
    // South America
    srcColor: new Color().setHex(0xffffff),
    tgtColor: new Color().setHex(Math.floor(Math.random() * 0xffffff)),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -46.4731, lat: -23.4356 }, // GRU

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -58.4173, lat: -34.8222 }, // EZE

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -43.2506, lat: -22.809 }, // GIG
    ],
  },
];

const gSmoothLinesDef = [
  {
    // satellite orbit
    tension: 0.5,
    closed: false,
    segments: 1,
    lineWidth: 3,
    dashed: false,
    dashSize: 500000,
    dashOffset: 0,
    gapSize: 500000,
    color: 0xff0000,
    showPoints: true,
    pointSize: 5,
    pointColor: 0x00ff00,
    points: [
      { lng: 0.0, lat: 0.0, height: 365000 },
      { lng: 4.949539922375, lat: 6.911948870339, height: 365000 },
      { lng: 9.481006504962, lat: 13.003303235164, height: 365000 },
      { lng: 14.26425660118, lat: 18.992935624701, height: 365000 },
      { lng: 19.437317142542, lat: 24.821552067078, height: 365000 },
      { lng: 25.159768140071, lat: 30.415302023853, height: 365000 },
      { lng: 31.615987159333, lat: 35.678888225604, height: 365000 },
      { lng: 39.00936483559, lat: 40.48761579387, height: 365000 },
      { lng: 47.535815028049, lat: 44.680356949202, height: 365000 },
      { lng: 57.32009552755, lat: 48.059028544832, height: 365000 },
      { lng: 68.308820741918, lat: 50.405040926321, height: 365000 },
      { lng: 80.162986652927, lat: 51.522838850015, height: 365000 },
      { lng: 92.261288237681, lat: 51.303093135128, height: 365000 },
      { lng: 103.890506323825, lat: 49.768223960262, height: 365000 },
      { lng: 114.509185336032, lat: 47.062468412525, height: 365000 },
      { lng: 123.878934379065, lat: 43.395346937687, height: 365000 },
      { lng: 132.01780616827, lat: 38.982131744262, height: 365000 },
      { lng: 139.08355282125, lat: 34.009608965595, height: 365000 },
      { lng: 145.27936815363, lat: 28.626512540378, height: 365000 },
      { lng: 150.804049943472, lat: 22.947086615961, height: 365000 },
      { lng: 155.833931182165, lat: 17.058812268693, height: 365000 },
      { lng: 160.520995039749, lat: 11.030115853069, height: 365000 },
      { lng: 164.997568074037, lat: 4.91681069065, height: 365000 },
      { lng: 169.383090488761, lat: -1.232729632493, height: 365000 },
      { lng: 173.791281447027, lat: -7.373268764029, height: 365000 },
      { lng: 178.337291628977, lat: -13.458794071173, height: 365000 },
      { lng: -176.855131310876, lat: -19.43850580926, height: 365000 },
      { lng: -171.646539941142, lat: -25.252222151448, height: 365000 },
      { lng: -165.875533431617, lat: -30.824734068301, height: 365000 },
      { lng: -159.355928681114, lat: -36.058813106545, height: 365000 },
      { lng: -151.88361483268, lat: -40.827228715135, height: 365000 },
      { lng: -143.265253547501, lat: -44.965949227061, height: 365000 },
      { lng: -133.385335002865, lat: -48.27447955244, height: 365000 },
      { lng: -122.315605878273, lat: -50.534085895503, height: 365000 },
      { lng: -110.418671494428, lat: -51.553438612106, height: 365000 },
      { lng: -98.331541792758, lat: -51.232088073855, height: 365000 },
      { lng: -86.763109548261, lat: -49.602758497446, height: 365000 },
      { lng: -76.234042581942, lat: -46.816890594992, height: 365000 },
      { lng: -66.960119841885, lat: -43.086281692035, height: 365000 },
      { lng: -58.908613734644, lat: -38.624885408099, height: 365000 },
      { lng: -51.915631117585, lat: -33.616718591681, height: 365000 },
      { lng: -45.777076919775, lat: -28.207699982727, height: 365000 },
      { lng: -40.295499426045, lat: -22.509773259564, height: 365000 },
      { lng: -35.29645869121, lat: -16.60872834561, height: 365000 },
      { lng: -30.629659440838, lat: -10.5718343827, height: 365000 },
      { lng: -26.163992293702, lat: -4.454177632725, height: 365000 },
    ],
  },
  {
    // Falcon 9 (Starlink ~53°) approximate launch trajectory (units: [lng, lat, alt_m])
    // Start point: SLC-40, Cape Canaveral (lon = -80.577366, lat = 28.561857)
    // Azimuth: ~43° (pointing northeast, consistent with ~53° orbital inclination)
    tension: 0.3,
    closed: false,
    segments: 1,
    lineWidth: 2,
    dashed: true,
    dashSize: 20000,
    dashOffset: 0,
    gapSize: 20000,
    color: 0x00ff00,
    showPoints: true,
    pointSize: 5,
    pointColor: 0xffff00,
    points: [
      { lng: -80.577366, lat: 28.561857, height: 0 },
      { lng: -80.542439, lat: 28.594739, height: 300 },
      { lng: -80.402512, lat: 28.726176, height: 12000 },
      { lng: -80.086386, lat: 29.021379, height: 28000 },
      { lng: -79.733011, lat: 29.348509, height: 45000 },
      { lng: -79.326674, lat: 29.705207, height: 65000 },
      { lng: -78.988658, lat: 29.992898, height: 80000 },
      { lng: -78.771331, lat: 30.169603, height: 85000 },
      { lng: -78.341938, lat: 30.516912, height: 100000 },
      { lng: -77.780105, lat: 30.974326, height: 120000 },
      { lng: -77.233909, lat: 31.420089, height: 135000 },
      { lng: -76.854212, lat: 31.718683, height: 145000 },
      { lng: -76.426336, lat: 32.027275, height: 153000 },
      { lng: -75.993014, lat: 32.33317, height: 160000 },
      { lng: -75.540683, lat: 32.645929, height: 163000 },
      { lng: -75.290448, lat: 32.807219, height: 165000 },
      { lng: -75.038846, lat: 32.967672, height: 167000 },
      { lng: -74.733973, lat: 33.159692, height: 170000 },
      { lng: -74.510757, lat: 33.292231, height: 172000 },
      { lng: -73.964238, lat: 33.606557, height: 185000 },
      { lng: -73.560021, lat: 33.834987, height: 195000 },
      { lng: -73.139247, lat: 34.058752, height: 205000 },
      { lng: -72.758, lat: 34.28, height: 215000 },
      { lng: -72.339, lat: 34.497, height: 225000 },
      { lng: -71.91, lat: 34.713, height: 235000 },
      { lng: -71.47, lat: 34.927, height: 245000 },
      { lng: -71.031, lat: 35.139, height: 255000 },
      { lng: -70.584, lat: 35.35, height: 265000 },
      { lng: -70.138, lat: 35.559, height: 275000 },
      { lng: -69.686, lat: 35.768, height: 285000 },
    ],
  },
];

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTile: {
      maxZoom: 15,
      minZoom: 5,
    },
    hillshade: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.openstreetmap.url,
    },
    rasterTile: {},
  });

  view.addMesh({
    axesHelper: {
      size: 5,
    },
    scale: new Vector3().setScalar(1e9),
  });

  plugin.addDefaultPhotorealScene();

  view.addEffect<CloudsEffectDesc>({
    clouds: {},
  });
  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addDateControl(view, pane);

  addArcLines(view, pane);
  addSmoothLines(view, pane);

  showAttributions([TERRAIN_DATASETS.gsi, TILE_DATASETS.openstreetmap]);
};

function intToHexColor(num: number) {
  return "#" + num.toString(16).padStart(6, "0");
}

const addArcLines = (view: ThreeView<CustomDescriptions>, pane: Pane) => {
  const arcLineLayer = view.addMesh<ArclineMeshDesc>({
    arcLines: gArcLinesDef,
  });

  // Create arc line group names
  const arcLineNames = [
    "Asia",
    "Oceania",
    "Europe",
    "North America",
    "South America",
  ];

  const params = {
    selectedGroup: 0,
    thickness: gArcLinesDef[0].thickness || 1,
    segments: gArcLinesDef[0].segments || 64,
    transparent: gArcLinesDef[0].transparent || false,
    opacity: gArcLinesDef[0].opacity || 1,
    srcColor: intToHexColor(gArcLinesDef[0].srcColor?.toHex() ?? 0xffffff),
    tgtColor: intToHexColor(gArcLinesDef[0].tgtColor?.toHex() ?? 0xffffff),
    height: gArcLinesDef[0].height || 0,
    arcHeightScale: gArcLinesDef[0].arcHeightScale || 0.3,
    gradation: gArcLinesDef[0].gradation || 0,
    gradAnim: false,
    dashed: gArcLinesDef[0].dashed || false,
    dashSize: gArcLinesDef[0].dashSize || 200000,
    dashOffset: gArcLinesDef[0].dashOffset || 0,
    gapSize: gArcLinesDef[0].gapSize || 200000,
    dashAnimation: false,
    dashAnimationSpeed: 10000,
  };

  const updateParams = (index: number) => {
    const selectedArcLine = gArcLinesDef[index];
    if (selectedArcLine) {
      params.thickness = selectedArcLine.thickness || 1;
      params.segments = selectedArcLine.segments || 64;
      params.transparent = selectedArcLine.transparent || false;
      params.opacity = selectedArcLine.opacity || 1;
      params.srcColor = intToHexColor(
        selectedArcLine.srcColor?.toHex() ?? 0xffffff,
      );
      params.tgtColor = intToHexColor(
        selectedArcLine.tgtColor?.toHex() ?? 0xffffff,
      );
      params.height = selectedArcLine.height || 0;
      params.arcHeightScale = selectedArcLine.arcHeightScale || 0.3;
      params.gradation = selectedArcLine.gradation || 0;
      params.dashed = selectedArcLine.dashed || false;
      params.dashSize = selectedArcLine.dashSize || 200000;
      params.dashOffset = selectedArcLine.dashOffset || 0;
      params.gapSize = selectedArcLine.gapSize || 200000;
    }
  };

  const onChange = () => {
    const selectedIndex = params.selectedGroup;
    if (gArcLinesDef[selectedIndex]) {
      gArcLinesDef[selectedIndex].thickness = params.thickness;
      gArcLinesDef[selectedIndex].segments = params.segments;
      gArcLinesDef[selectedIndex].transparent = params.transparent;
      gArcLinesDef[selectedIndex].opacity = params.opacity;
      gArcLinesDef[selectedIndex].srcColor = new Color().setHex(
        parseInt(params.srcColor.replace("#", ""), 16),
      );
      gArcLinesDef[selectedIndex].tgtColor = new Color().setHex(
        parseInt(params.tgtColor.replace("#", ""), 16),
      );
      gArcLinesDef[selectedIndex].height = params.height;
      gArcLinesDef[selectedIndex].arcHeightScale = params.arcHeightScale;
      gArcLinesDef[selectedIndex].gradation = params.gradation;
      gArcLinesDef[selectedIndex].dashed = params.dashed;
      gArcLinesDef[selectedIndex].dashSize = params.dashSize;
      gArcLinesDef[selectedIndex].dashOffset = params.dashOffset;
      gArcLinesDef[selectedIndex].gapSize = params.gapSize;
      arcLineLayer.update({ arcLines: gArcLinesDef });
    }
  };

  const folder = pane.addFolder({
    title: "ArcLine",
  });

  // Add dropdown for selecting arc line group
  folder
    .addBinding(params, "selectedGroup", {
      view: "list",
      label: "Arc Group",
      options: arcLineNames
        .map((name, index) => ({ text: name, value: index }))
        .filter((_, index) => index < gArcLinesDef.length), // Only show groups that exist
    })
    .on("change", () => {
      updateParams(params.selectedGroup);
      folder.refresh(); // Refresh to update all parameter displays
    });

  folder
    .addBinding(params, "thickness", { min: 0.1, max: 10, step: 0.1 })
    .on("change", () => {
      onChange();
    });

  folder
    .addBinding(params, "segments", { min: 2, max: 128, step: 1 })
    .on("change", () => {
      onChange();
    });

  folder.addBinding(params, "transparent").on("change", () => {
    onChange();
  });
  folder
    .addBinding(params, "opacity", { min: 0, max: 1, step: 0.01 })
    .on("change", () => {
      onChange();
    });

  folder.addBinding(params, "srcColor").on("change", () => {
    onChange();
  });

  folder.addBinding(params, "tgtColor").on("change", () => {
    onChange();
  });

  folder.addBinding(params, "height").on("change", () => {
    onChange();
  });

  folder
    .addBinding(params, "arcHeightScale", { min: 0, max: 1, step: 0.01 })
    .on("change", () => {
      onChange();
    });

  folder
    .addBinding(params, "gradation", { min: 0, max: 1, step: 0.01 })
    .on("change", () => {
      onChange();
    });

  folder.addBinding(params, "gradAnim");

  // Dash controls subfolder
  const dashFolder = folder.addFolder({
    title: "Dash Settings",
  });

  dashFolder.addBinding(params, "dashed").on("change", () => {
    onChange();
  });

  dashFolder
    .addBinding(params, "dashSize", { min: 1, max: 1000000, step: 1 })
    .on("change", () => {
      onChange();
    });

  dashFolder.addBinding(params, "dashOffset").on("change", () => {
    onChange();
  });

  dashFolder
    .addBinding(params, "gapSize", { min: 1, max: 1000000, step: 1 })
    .on("change", () => {
      onChange();
    });

  dashFolder.addBinding(params, "dashAnimation");

  dashFolder.addBinding(params, "dashAnimationSpeed", {
    min: -100000,
    max: 100000,
    step: 1,
  });

  const gradAnimFunc = () => {
    if (params.gradAnim) {
      gArcLinesDef.forEach((arcLineDef) => {
        arcLineDef.gradation = (arcLineDef.gradation || 0) + 0.005;
        if (arcLineDef.gradation > 1) {
          arcLineDef.gradation = 0;
        }
      });

      arcLineLayer.update({ arcLines: gArcLinesDef });
    }
    requestAnimationFrame(gradAnimFunc);
  };
  gradAnimFunc();

  const dashAnimFunc = () => {
    if (params.dashAnimation) {
      gArcLinesDef.forEach((arcLineDef, i) => {
        arcLineDef.dashOffset =
          (arcLineDef.dashOffset ?? 0) + params.dashAnimationSpeed;

        if (i == params.selectedGroup) {
          params.dashOffset = arcLineDef.dashOffset;
        }
      });

      arcLineLayer.update({ arcLines: gArcLinesDef });

      if (dashFolder) {
        dashFolder.refresh();
      }
    }
    requestAnimationFrame(dashAnimFunc);
  };
  dashAnimFunc();
};

const addSmoothLines = (view: ThreeView<CustomDescriptions>, pane: Pane) => {
  const smoothLineLayer = view.addMesh<SmoothLineMeshDesc>({
    smoothLines: gSmoothLinesDef,
  });

  let animationId: number | null = null;

  // Create smooth line group names
  const smoothLineNames = ["Satellite Orbit", "Falcon 9 Launch"];

  const params = {
    selectedGroup: 0,
    tension: gSmoothLinesDef[0].tension || 0.5,
    closed: gSmoothLinesDef[0].closed || false,
    segments: gSmoothLinesDef[0].segments || 64,
    lineWidth: gSmoothLinesDef[0].lineWidth || 1,
    dashed: gSmoothLinesDef[0].dashed || false,
    dashSize: gSmoothLinesDef[0].dashSize || 1,
    dashOffset: gSmoothLinesDef[0].dashOffset || 0,
    gapSize: gSmoothLinesDef[0].gapSize || 1,
    color: intToHexColor(gSmoothLinesDef[0].color || 0xffffff),
    showPoints: gSmoothLinesDef[0].showPoints ?? true,
    pointSize: gSmoothLinesDef[0].pointSize || 2,
    pointColor: intToHexColor(gSmoothLinesDef[0].pointColor || 0xffffff),
    dashAnimation: false,
    dashAnimationSpeed: 10000,
  };

  const updateParams = (index: number) => {
    const selectedSmoothLine = gSmoothLinesDef[index];
    if (selectedSmoothLine) {
      params.tension = selectedSmoothLine.tension || 0.5;
      params.closed = selectedSmoothLine.closed || false;
      params.segments = selectedSmoothLine.segments || 64;
      params.lineWidth = selectedSmoothLine.lineWidth || 1;
      params.dashed = selectedSmoothLine.dashed || false;
      params.dashSize = selectedSmoothLine.dashSize || 1;
      params.dashOffset = selectedSmoothLine.dashOffset || 0;
      params.gapSize = selectedSmoothLine.gapSize || 1;
      params.color = intToHexColor(selectedSmoothLine.color || 0xffffff);
      params.showPoints = selectedSmoothLine.showPoints ?? true;
      params.pointSize = selectedSmoothLine.pointSize || 2;
      params.pointColor = intToHexColor(
        selectedSmoothLine.pointColor || 0xffffff,
      );
    }
  };

  const onChange = () => {
    const selectedIndex = params.selectedGroup;
    if (gSmoothLinesDef[selectedIndex]) {
      gSmoothLinesDef[selectedIndex].tension = params.tension;
      gSmoothLinesDef[selectedIndex].closed = params.closed;
      gSmoothLinesDef[selectedIndex].segments = params.segments;
      gSmoothLinesDef[selectedIndex].lineWidth = params.lineWidth;
      gSmoothLinesDef[selectedIndex].dashed = params.dashed;
      gSmoothLinesDef[selectedIndex].dashSize = params.dashSize;
      gSmoothLinesDef[selectedIndex].dashOffset = params.dashOffset;
      gSmoothLinesDef[selectedIndex].gapSize = params.gapSize;
      gSmoothLinesDef[selectedIndex].color = parseInt(
        params.color.replace("#", ""),
        16,
      );
      gSmoothLinesDef[selectedIndex].showPoints = params.showPoints;
      gSmoothLinesDef[selectedIndex].pointSize = params.pointSize;
      gSmoothLinesDef[selectedIndex].pointColor = parseInt(
        params.pointColor.replace("#", ""),
        16,
      );
      smoothLineLayer.update({ smoothLines: gSmoothLinesDef });
    }
  };

  const folder = pane.addFolder({
    title: "SmoothLine",
  });

  const startDashAnimation = () => {
    if (animationId !== null) return; // Already animating

    const animate = () => {
      const selectedIndex = params.selectedGroup;
      if (gSmoothLinesDef[selectedIndex] && params.dashed) {
        gSmoothLinesDef[selectedIndex].dashOffset += params.dashAnimationSpeed;
        params.dashOffset = gSmoothLinesDef[selectedIndex].dashOffset;
        smoothLineLayer.update({ smoothLines: gSmoothLinesDef });

        if (dashFolder) {
          dashFolder.refresh();
        }
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();
  };

  const stopDashAnimation = () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  // Add dropdown for selecting smooth line group
  folder
    .addBinding(params, "selectedGroup", {
      view: "list",
      label: "Line Group",
      options: smoothLineNames
        .map((name, index) => ({ text: name, value: index }))
        .filter((_, index) => index < gSmoothLinesDef.length), // Only show groups that exist
    })
    .on("change", () => {
      updateParams(params.selectedGroup);
      folder.refresh(); // Refresh to update all parameter displays
    });

  // Curve parameters
  folder
    .addBinding(params, "tension", { min: 0, max: 1, step: 0.01 })
    .on("change", () => {
      onChange();
    });

  folder.addBinding(params, "closed").on("change", () => {
    onChange();
  });

  folder
    .addBinding(params, "segments", { min: 1, max: 64, step: 1 })
    .on("change", () => {
      onChange();
    });

  // Line appearance
  folder
    .addBinding(params, "lineWidth", { min: 0.1, max: 20, step: 0.1 })
    .on("change", () => {
      onChange();
    });

  folder.addBinding(params, "color").on("change", () => {
    onChange();
  });

  // Point parameters
  folder.addBinding(params, "showPoints").on("change", () => {
    onChange();
  });

  folder
    .addBinding(params, "pointSize", { min: 1, max: 20, step: 0.5 })
    .on("change", () => {
      onChange();
    });

  folder.addBinding(params, "pointColor").on("change", () => {
    onChange();
  });

  // Dash controls subfolder
  const dashFolder = folder.addFolder({
    title: "Dash Settings",
  });

  dashFolder.addBinding(params, "dashed").on("change", () => {
    onChange();
  });

  dashFolder
    .addBinding(params, "dashSize", { min: 1, max: 1000000, step: 1 })
    .on("change", () => {
      onChange();
    });

  dashFolder.addBinding(params, "dashOffset").on("change", () => {
    onChange();
  });

  dashFolder
    .addBinding(params, "gapSize", { min: 1, max: 1000000, step: 1 })
    .on("change", () => {
      onChange();
    });

  dashFolder.addBinding(params, "dashAnimation").on("change", () => {
    if (params.dashAnimation) {
      startDashAnimation();
    } else {
      stopDashAnimation();
    }
  });

  dashFolder.addBinding(params, "dashAnimationSpeed", {
    min: 1,
    max: 100000,
    step: 1,
  });
};
