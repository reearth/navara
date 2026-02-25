import { useViewContext } from "@navara/three_react";
import { useEffect, useState } from "react";

import { FLOOD_RANK_COLOR_MAP } from "../../../helpers/colors";

import { AttributionPanel, type Attribution } from "./AttributionPanel";
import type { BuildingColorAttribute } from "./BuildingLayer";
import { MEASURED_HEIGHT_GRADIENT, FIREPROOF_COLOR_MAP } from "./BuildingLayer";
import {
  ControlPanel,
  type SequantialData,
  type DiscreteData,
} from "./ControlPanel";
import {
  UC_PHOTOREALISTIC_ATTRIBUTION_DATASETS,
  UC_PHOTOREALISTIC_DATASETS,
  BUILDING_DATASETS,
} from "./datasets";
import { FloodLayer } from "./FloodLayer";
import { useI18n, type LanguageDictionary } from "./i18n";
import { Layers } from "./Layers";
import type { QualityFlags } from "./quality";
import { ShelterLayer } from "./ShelterLayer";

// Build attributions from the dataset bundle so the panel
// stays in sync with actual layers and helper constants.
const ATTRIBUTIONS: Attribution[] =
  UC_PHOTOREALISTIC_ATTRIBUTION_DATASETS.filter((d) => !!d.attribution).map(
    (d) => ({ name: d.attribution ?? "", url: d.attributionUrl }),
  );

const LABELS = {
  "Measured Height": {
    ja: "計測高さ",
  },
  "Fireproof Structure": {
    ja: "耐火構造",
  },
  Fireproof: {
    ja: "耐火",
  },
  "Semi-fireproof": {
    ja: "準耐火造",
  },
  Other: {
    ja: "その他",
  },
  Unknown: {
    ja: "不明",
  },
  "Flood Rank (Arakawa Maximum Scale)": {
    ja: "浸水ランク (荒川 想定最大規模)",
  },
  "Flood Simulation": {
    ja: "浸水シミュレーション",
  },
  "Water Surface": {
    ja: "水面",
  },
  "Water Area": {
    ja: "水辺",
  },
} satisfies LanguageDictionary;

export const PhotorealisticScene = () => {
  const { translate } = useI18n(LABELS);
  // UI state
  const [sceneTime, setSceneTime] = useState<number[]>([8]);
  const [buildingsVisible, setBuildingsVisible] = useState(true);
  const [buildingColorAttribute, setBuildingColorAttribute] =
    useState<BuildingColorAttribute>("none");
  const [evacuationVisible, setEvacuationVisible] = useState(false);
  const [cloudsVisible, setCloudsVisible] = useState(true);
  const [rainVisible, setRainVisible] = useState(true);
  const [quality, setQuality] = useState<QualityFlags>("low");
  const [autoRotate, setAutoRotate] = useState(false);
  const [cloudShadow, setCloudShadow] = useState(false);
  const [waterSurface, setWaterSurface] = useState(true);
  const [waterAreaVisible, setWaterAreaVisible] = useState(false);

  // Individual building visibility (initially all true)
  const [individualBuildingVisibility, setIndividualBuildingVisibility] =
    useState<boolean[]>(BUILDING_DATASETS.map((d) => d.initial));

  // Navara view
  const { view } = useViewContext();

  useEffect(() => {
    view.setCamera({
      lng: 139.59881128222656,
      lat: 35.84946060180664,
      height: 605.57421875,
      heading: 6.282135009765625,
      pitch: -16.686492919921875,
      roll: 0.0,
    });
  }, [view]);

  // Camera auto-rotation loop
  useEffect(() => {
    if (!view || !autoRotate) return;

    const f = () => {
      view.rotateAround(0.002);
    };

    view.on("postRender", f);

    return () => view.off("postRender", f);
  }, [view, autoRotate]);

  // Sync sceneTime slider with Navara atmosphere date (similar to addDateControl)
  useEffect(() => {
    if (!view) return;
    const t = sceneTime[0] ?? 12; // hours in [0, 24], step 0.5
    const hours = Math.floor(t);
    const minutes = Math.round((t - hours) * 60);

    // Use current date; only adjust hours/minutes like addDateControl does
    const d = new Date(view.atmosphere.date ?? Date.now());
    d.setHours(hours);
    d.setMinutes(minutes);
    view.atmosphere.date = d;
  }, [view, sceneTime]);

  // Flood
  const [floodVisible, setFloodVisible] = useState(true);
  const [floodProgress, setFloodProgress] = useState<number[]>([30]);
  const [floodSimulationHours, setFloodSimulationHours] = useState<number>(0);
  const [floodSimulationStartDate, setFloodSimulationStartDate] =
    useState<Date | null>(null);
  const [floodCurrentDate, setFloodCurrentDate] = useState<Date | null>(null);
  const [floodSyncWithAtmosphere, setFloodSyncWithAtmosphere] = useState(false);

  // Sync atmosphere date when flood progress changes
  useEffect(() => {
    if (!floodSyncWithAtmosphere || !view || !floodCurrentDate) {
      return;
    }

    // Update atmosphere date to match flood simulation date
    const newDate = new Date(floodCurrentDate);
    view.atmosphere.date = newDate;

    // Also update sceneTime to reflect the new hours/minutes
    const hours = newDate.getHours();
    const minutes = newDate.getMinutes();
    const timeValue = hours + minutes / 60;
    setSceneTime([timeValue]);
  }, [floodSyncWithAtmosphere, view, floodCurrentDate]);

  const buildingColorData = {
    "bldg:measuredHeight": {
      type: "sequantial",
      min: 0,
      max: 60,
      colors: [...MEASURED_HEIGHT_GRADIENT],
      title: translate("Measured Height"),
    } satisfies SequantialData,
    "uro:BuildingDetailAttribute_uro:fireproofStructureType": {
      type: "discrete",
      title: translate("Fireproof Structure"),
      legends: [
        translate("Fireproof"),
        translate("Semi-fireproof"),
        translate("Other"),
        translate("Unknown"),
      ].map((label) => ({
        label,
        color:
          FIREPROOF_COLOR_MAP[
            label === translate("Fireproof")
              ? "耐火"
              : label === translate("Semi-fireproof")
                ? "準耐火造"
                : label === translate("Other")
                  ? "その他"
                  : "不明"
          ] ?? "#cccccc",
      })),
    } satisfies DiscreteData,
    "荒川水系荒川（国管理区間）_L2（想定最大規模）_浸水ランクコード": {
      type: "discrete",
      title: translate("Flood Rank (Arakawa Maximum Scale)"),
      legends: [
        { key: 6, label: "6: 20m〜" },
        { key: 5, label: "5: 10m〜20m" },
        { key: 4, label: "4: 5m〜10m" },
        { key: 3, label: "3: 3m〜5m" },
        { key: 2, label: "2: 0.5m〜3m" },
        { key: 1, label: "1: 〜0.5m" },
      ].map(({ key, label }) => ({
        label,
        color: FLOOD_RANK_COLOR_MAP[key] ?? "#e6e6e6",
      })),
    } satisfies DiscreteData,
  } satisfies Record<
    Exclude<BuildingColorAttribute, "none">,
    SequantialData | DiscreteData
  >;

  return (
    <>
      <Layers
        buildingsVisible={buildingsVisible}
        buildingColorAttribute={buildingColorAttribute}
        cloudsEffectVisible={cloudsVisible}
        rainVisible={rainVisible}
        quality={quality}
        cloudShadow={cloudShadow}
        waterSurface={waterSurface}
        waterAreaVisible={waterAreaVisible}
        individualBuildingVisibility={individualBuildingVisibility}
      />

      <FloodLayer
        url={UC_PHOTOREALISTIC_DATASETS.floodCzml.url}
        visible={floodVisible}
        progressPercent={floodProgress[0] ?? 0}
        waterSurface={waterSurface}
        onSimulationHoursCalculated={setFloodSimulationHours}
        onSimulationStartDateCalculated={setFloodSimulationStartDate}
        onCurrentDateChange={setFloodCurrentDate}
      />

      <ShelterLayer visible={evacuationVisible} />

      <ControlPanel
        sceneTime={sceneTime}
        onSceneTimeChange={setSceneTime}
        buildingsVisible={buildingsVisible}
        setBuildingsVisible={setBuildingsVisible}
        buildingColorAttribute={buildingColorAttribute}
        setBuildingColorAttribute={setBuildingColorAttribute}
        buildingColorData={buildingColorData}
        individualBuildingVisibility={individualBuildingVisibility}
        setIndividualBuildingVisibility={setIndividualBuildingVisibility}
        evacuationVisible={evacuationVisible}
        setEvacuationVisible={setEvacuationVisible}
        cloudsVisible={cloudsVisible}
        setCloudsVisible={setCloudsVisible}
        rainVisible={rainVisible}
        setRainVisible={setRainVisible}
        quality={quality}
        setQuality={setQuality}
        autoRotate={autoRotate}
        setAutoRotate={setAutoRotate}
        cloudShadow={cloudShadow}
        setCloudShadow={setCloudShadow}
        waterSurface={waterSurface}
        setWaterSurface={setWaterSurface}
        waterSurfaceLabel={translate("Water Surface")}
        waterAreaVisible={waterAreaVisible}
        setWaterAreaVisible={setWaterAreaVisible}
        waterAreaLabel={translate("Water Area")}
        floodLabel={translate("Flood Simulation")}
        floodVisible={floodVisible}
        setFloodVisible={setFloodVisible}
        floodProgress={floodProgress}
        setFloodProgress={setFloodProgress}
        floodSimulationHours={floodSimulationHours}
        floodSimulationStartDate={floodSimulationStartDate}
        floodCurrentDate={floodCurrentDate}
        floodSyncWithAtmosphere={floodSyncWithAtmosphere}
        setFloodSyncWithAtmosphere={setFloodSyncWithAtmosphere}
      />

      <AttributionPanel attributions={ATTRIBUTIONS} />
    </>
  );
};
