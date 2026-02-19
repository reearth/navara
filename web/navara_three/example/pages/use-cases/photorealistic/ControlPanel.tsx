import type { ColorTuple } from "@navara/three";
import {
  Layers as LayersIcon,
  Clock,
  Cloud,
  CloudRain,
  Building,
  Droplets,
  ChevronDown,
  Palette,
  Shield,
  Settings,
} from "lucide-react";
import React from "react";

import type { BuildingColorAttribute } from "./BuildingLayer";
import { BUILDING_DATASETS } from "./datasets";
import { useI18n, type LanguageDictionary } from "./i18n";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export type SequantialData = {
  type: "sequantial";
  min: number;
  max: number;
  colors: (string | ColorTuple)[];
  title: string;
};
export type DiscreteData = {
  type: "discrete";
  legends: { label: string; color: string | ColorTuple }[];
  title: string;
};

type BuildingLegendMap = Record<
  Exclude<BuildingColorAttribute, "none">,
  SequantialData | DiscreteData
>;

export type ControlPanelProps = {
  sceneTime: number[];
  onSceneTimeChange: (v: number[]) => void;

  buildingsVisible: boolean;
  setBuildingsVisible: (v: boolean) => void;
  buildingColorAttribute: BuildingColorAttribute;
  setBuildingColorAttribute: (v: BuildingColorAttribute) => void;
  /**
   * Building coloring legend/scale data for each attribute.
   * Required so that ControlPanel can render legends without duplicating
   * values defined alongside BuildingLayer.
   */
  buildingColorData: BuildingLegendMap;
  individualBuildingVisibility: boolean[];
  setIndividualBuildingVisibility: (v: boolean[]) => void;

  evacuationVisible: boolean;
  setEvacuationVisible: (v: boolean) => void;

  cloudsVisible: boolean;
  setCloudsVisible: (v: boolean) => void;
  rainVisible: boolean;
  setRainVisible: (v: boolean) => void;

  // Auxiliary controls
  quality: "ultra" | "high" | "medium" | "low";
  setQuality: (v: "ultra" | "high" | "medium" | "low") => void;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  cloudShadow: boolean;
  setCloudShadow: (v: boolean) => void;
  waterSurface: boolean;
  setWaterSurface: (v: boolean) => void;
  waterSurfaceLabel: string;
  waterAreaVisible: boolean;
  setWaterAreaVisible: (v: boolean) => void;
  waterAreaLabel: string;

  floodLabel: string;
  floodVisible: boolean;
  setFloodVisible: (v: boolean) => void;
  floodProgress: number[]; // 0..100
  setFloodProgress: (v: number[]) => void;
  /**
   * Total simulation time in hours (default: 72 hours = 3 days)
   * Used to display hours instead of percentage
   */
  floodSimulationHours?: number;
  /**
   * The start date of the flood simulation
   */
  floodSimulationStartDate: Date | null;
  /**
   * The current date in the flood simulation based on progress
   */
  floodCurrentDate: Date | null;
  /**
   * Whether to sync flood simulation with viewer.atmosphere.date
   */
  floodSyncWithAtmosphere: boolean;
  setFloodSyncWithAtmosphere: (v: boolean) => void;
};

const LABELS = {
  "No Coloring": {
    ja: "色分けなし",
  },
  Layers: {
    ja: "レイヤー",
  },
  "Scene Time": {
    ja: "シーン時刻",
  },
  "Building Data": {
    ja: "建築物データ",
  },
  "Color Attribute": {
    ja: "色分け属性",
  },
  Legend: {
    ja: "凡例",
  },
  "Evacuation Facilities": {
    ja: "避難施設",
  },
  "Elapsed hours": {
    ja: "経過時間",
  },
  "Sync with Scene Time": {
    ja: "シーン時刻と同期",
  },
  Clouds: {
    ja: "雲",
  },
  Rain: {
    ja: "雨",
  },
  Options: {
    ja: "オプション",
  },
  Quality: {
    ja: "品質",
  },
  "Auto Rotate": {
    ja: "自動回転",
  },
  "Cloud Shadow": {
    ja: "雲の影",
  },
  "Water Surface": {
    ja: "水面",
  },
  "Enable All Buildings": {
    ja: "すべての建物を表示",
  },
  h: {
    ja: "時間",
  },
} satisfies LanguageDictionary;

export function ControlPanel(props: ControlPanelProps) {
  const { translate, lang } = useI18n(LABELS);
  const [isOpen, setIsOpen] = React.useState(true);
  const [buildingsExpanded, setBuildingsExpanded] = React.useState(true);
  const [floodExpanded, setFloodExpanded] = React.useState(true);
  const [optionsExpanded, setOptionsExpanded] = React.useState(false);
  const toCssColor = React.useCallback((c: string | ColorTuple): string => {
    if (typeof c === "string") return c;
    const [r, g, b] = c;
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  // Convert flood progress (0-100) to hours
  const floodHours = React.useMemo(() => {
    const totalHours = props.floodSimulationHours ?? 72;
    return ((props.floodProgress[0] ?? 0) * totalHours) / 100;
  }, [props.floodProgress, props.floodSimulationHours]);

  // Format hours for display with localization
  // Japanese: "24.5時間", English: "24.5h"
  const formatHours = React.useCallback(
    (hours: number): string => {
      // Round to 1 decimal place
      const rounded = Math.round(hours * 10) / 10;
      const hoursSuffix = translate("h");
      // Japanese uses "時間", English uses "h"
      return `${rounded}${hoursSuffix}`;
    },
    [translate],
  );

  // Format full date with elapsed time: "2024/06/10 11:10 (2h elapsed)"
  const formatFloodDate = React.useCallback(
    (currentDate: Date | null, startDate: Date | null): string => {
      if (!currentDate || !startDate) {
        return formatHours(floodHours);
      }

      // Format date as YYYY/MM/DD HH:MM
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      const hours = String(currentDate.getHours()).padStart(2, "0");
      const minutes = String(currentDate.getMinutes()).padStart(2, "0");

      const dateStr = `${year}/${month}/${day} ${hours}:${minutes}`;

      // Calculate elapsed hours
      const elapsedMs = currentDate.getTime() - startDate.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      return `${dateStr} (${formatHours(elapsedHours)})`;
    },
    [floodHours, formatHours],
  );

  // Helper to check if all buildings are enabled
  const allBuildingsEnabled = React.useMemo(() => {
    return props.individualBuildingVisibility.every((v) => v);
  }, [props.individualBuildingVisibility]);

  // Helper to toggle all buildings
  const handleToggleAllBuildings = React.useCallback(
    (checked: boolean) => {
      props.setIndividualBuildingVisibility(
        BUILDING_DATASETS.map(() => checked),
      );
    },
    [props],
  );

  // Helper to toggle individual building
  const handleToggleIndividualBuilding = React.useCallback(
    (index: number, checked: boolean) => {
      const newVisibility = [...props.individualBuildingVisibility];
      newVisibility[index] = checked;
      props.setIndividualBuildingVisibility(newVisibility);
    },
    [props],
  );

  // Derived helpers from provided buildingColorData
  const measuredConfig = React.useMemo(() => {
    return props.buildingColorData["bldg:measuredHeight"] as
      | SequantialData
      | undefined;
  }, [props.buildingColorData]);

  const attributeTitles = React.useMemo(() => {
    return {
      none: translate("No Coloring"),
      "bldg:measuredHeight":
        props.buildingColorData["bldg:measuredHeight"].title,
      "uro:BuildingDetailAttribute_uro:fireproofStructureType":
        props.buildingColorData[
          "uro:BuildingDetailAttribute_uro:fireproofStructureType"
        ].title,
      "荒川水系荒川（国管理区間）_L2（想定最大規模）_浸水ランクコード":
        props.buildingColorData[
          "荒川水系荒川（国管理区間）_L2（想定最大規模）_浸水ランクコード"
        ].title,
    } as const;
  }, [props.buildingColorData, translate]);

  return (
    <div className="fixed top-6 left-6 z-50 w-80">
      <Card className="bg-card border-border shadow-lg overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-accent transition-colors p-4 border-b border-border">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-card-foreground">
                  <LayersIcon className="w-4 h-4" />
                  <span className="font-semibold">{translate("Layers")}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Scene time (cosmetic) */}
              <div className="bg-accent rounded-lg p-3 space-y-3 border border-border">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-foreground text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    {translate("Scene Time")}
                  </Label>
                  <span className="text-foreground font-mono text-sm font-semibold">
                    {String(Math.floor(props.sceneTime[0] ?? 12)).padStart(
                      2,
                      "0",
                    )}
                    :00
                  </span>
                </div>
                <Slider
                  value={props.sceneTime}
                  onValueChange={props.onSceneTimeChange}
                  min={0}
                  max={24}
                  step={0.5}
                />
              </div>

              <div className="h-px bg-border" />

              {/* Flood */}
              <div className="space-y-2">
                <Collapsible
                  open={floodExpanded}
                  onOpenChange={setFloodExpanded}
                >
                  <div className="bg-muted rounded-lg border border-border overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors">
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${floodExpanded ? "rotate-0" : "-rotate-90"}`}
                        />
                        <Label className="flex-1 text-foreground text-sm font-medium cursor-pointer flex items-center gap-2">
                          <Droplets className="w-4 h-4" />
                          {props.floodLabel}
                        </Label>
                        <Switch
                          checked={props.floodVisible}
                          onCheckedChange={props.setFloodVisible}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {props.floodVisible && (
                        <div className="px-3 pb-3 pt-1 space-y-2 bg-card border-t border-border">
                          <div className="flex items-center justify-between text-xs">
                            <Label className="text-muted-foreground font-medium">
                              {translate("Elapsed hours")}
                            </Label>
                            <span className="text-foreground font-mono text-[10px] font-semibold">
                              {formatFloodDate(
                                props.floodCurrentDate,
                                props.floodSimulationStartDate,
                              )}
                            </span>
                          </div>
                          <Slider
                            value={props.floodProgress}
                            onValueChange={props.setFloodProgress}
                            min={0}
                            max={100}
                            step={1}
                          />
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <Label className="text-muted-foreground text-xs font-medium cursor-pointer">
                              {translate("Sync with Scene Time")}
                            </Label>
                            <Switch
                              checked={props.floodSyncWithAtmosphere}
                              onCheckedChange={props.setFloodSyncWithAtmosphere}
                            />
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>

              {/* Buildings */}
              <div className="space-y-2">
                <Collapsible
                  open={buildingsExpanded}
                  onOpenChange={setBuildingsExpanded}
                >
                  <div className="bg-muted rounded-lg border border-border overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors">
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${buildingsExpanded ? "rotate-0" : "-rotate-90"}`}
                        />
                        <Label className="flex-1 text-foreground text-sm font-medium cursor-pointer flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          {translate("Building Data")}
                        </Label>
                        <Switch
                          checked={props.buildingsVisible}
                          onCheckedChange={props.setBuildingsVisible}
                        />
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      {props.buildingsVisible && (
                        <div className="p-3 space-y-3 bg-card border-t border-border">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-foreground text-xs font-medium">
                              <Palette className="w-3.5 h-3.5" />
                              {translate("Color Attribute")}
                            </Label>
                            <Select
                              value={props.buildingColorAttribute}
                              onValueChange={props.setBuildingColorAttribute}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  {attributeTitles.none}
                                </SelectItem>
                                <SelectItem value="bldg:measuredHeight">
                                  {attributeTitles["bldg:measuredHeight"]}
                                </SelectItem>
                                <SelectItem value="uro:BuildingDetailAttribute_uro:fireproofStructureType">
                                  {
                                    attributeTitles[
                                      "uro:BuildingDetailAttribute_uro:fireproofStructureType"
                                    ]
                                  }
                                </SelectItem>
                                <SelectItem value="荒川水系荒川（国管理区間）_L2（想定最大規模）_浸水ランクコード">
                                  {
                                    attributeTitles[
                                      "荒川水系荒川（国管理区間）_L2（想定最大規模）_浸水ランクコード"
                                    ]
                                  }
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {props.buildingColorAttribute !== "none" && (
                            <div className="space-y-1.5 pt-2 border-t border-border">
                              <Label className="text-muted-foreground text-xs font-medium">
                                {translate("Legend")}
                              </Label>
                              {(
                                props.buildingColorData[
                                  props.buildingColorAttribute as Exclude<
                                    BuildingColorAttribute,
                                    "none"
                                  >
                                ] as SequantialData | DiscreteData
                              ).type === "sequantial" ? (
                                <div className="space-y-1">
                                  {/* Continuous: gradient bar with numeric min/max */}
                                  <div
                                    className="w-full h-3 rounded border border-border"
                                    style={{
                                      background: `linear-gradient(to right, ${(
                                        props.buildingColorData[
                                          "bldg:measuredHeight"
                                        ] as SequantialData
                                      ).colors
                                        .map(toCssColor)
                                        .join(", ")})`,
                                    }}
                                  />
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="font-mono">
                                      {measuredConfig?.min} m
                                    </span>
                                    <span className="font-mono">
                                      {measuredConfig?.max} m
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {(
                                    props.buildingColorData[
                                      props.buildingColorAttribute as Exclude<
                                        BuildingColorAttribute,
                                        "none"
                                      >
                                    ] as DiscreteData
                                  ).legends.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <div
                                        className="w-3.5 h-3.5 rounded border border-border flex-shrink-0"
                                        style={{
                                          backgroundColor: toCssColor(
                                            item.color,
                                          ),
                                        }}
                                      />
                                      <span className="text-foreground">
                                        {item.label}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Individual Buildings Section */}
                          <div className="space-y-3 pt-3 border-t border-border">
                            <div className="flex items-center justify-between gap-3 px-1 py-1">
                              <Label className="text-foreground text-xs font-medium">
                                {translate("Enable All Buildings")}
                              </Label>
                              <Switch
                                checked={allBuildingsEnabled}
                                onCheckedChange={handleToggleAllBuildings}
                              />
                            </div>
                            <div className="h-px bg-border" />
                            <div className="space-y-4">
                              {BUILDING_DATASETS.map((dataset, index) => (
                                <div
                                  key={dataset.url}
                                  className="flex items-center justify-between gap-3 px-1"
                                >
                                  <Label className="text-foreground text-xs cursor-pointer">
                                    {lang === "ja"
                                      ? dataset.label.ja
                                      : dataset.label.en}
                                  </Label>
                                  <Switch
                                    checked={
                                      props.individualBuildingVisibility[index]
                                    }
                                    onCheckedChange={(checked: any) =>
                                      handleToggleIndividualBuilding(
                                        index,
                                        checked,
                                      )
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>

              {/* Evacuation Facilities */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-3 py-2.5 bg-muted rounded-lg border border-border hover:bg-accent transition-colors">
                  <Label className="flex-1 text-foreground text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {translate("Evacuation Facilities")}
                  </Label>
                  <Switch
                    checked={props.evacuationVisible}
                    onCheckedChange={props.setEvacuationVisible}
                  />
                </div>
              </div>

              {/* Water Area */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-3 py-2.5 bg-muted rounded-lg border border-border hover:bg-accent transition-colors">
                  <Label className="flex-1 text-foreground text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    {props.waterAreaLabel}
                  </Label>
                  <Switch
                    checked={props.waterAreaVisible}
                    onCheckedChange={props.setWaterAreaVisible}
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Weather */}
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-muted rounded-lg border border-border hover:bg-accent transition-colors">
                    <Label className="flex-1 text-foreground text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Cloud className="w-4 h-4" />
                      {translate("Clouds")}
                    </Label>
                    <Switch
                      checked={props.cloudsVisible}
                      onCheckedChange={props.setCloudsVisible}
                    />
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-muted rounded-lg border border-border hover:bg-accent transition-colors">
                    <Label className="flex-1 text-foreground text-sm font-medium cursor-pointer flex items-center gap-2">
                      <CloudRain className="w-4 h-4" />
                      {translate("Rain")}
                    </Label>
                    <Switch
                      checked={props.rainVisible}
                      onCheckedChange={props.setRainVisible}
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Options (bottom) */}
              <div className="space-y-2">
                <Collapsible
                  open={optionsExpanded}
                  onOpenChange={setOptionsExpanded}
                >
                  <div className="bg-muted rounded-lg border border-border overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors">
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${optionsExpanded ? "rotate-0" : "-rotate-90"}`}
                        />
                        <Label className="flex-1 text-foreground text-sm font-medium cursor-pointer flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          {translate("Options")}
                        </Label>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-3 space-y-3 bg-card border-t border-border">
                        <div className="flex items-center justify-between gap-3 px-1 py-1">
                          <Label className="text-foreground text-sm font-medium w-full">
                            {translate("Quality")}
                          </Label>
                          <Select
                            value={props.quality}
                            onValueChange={props.setQuality}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ultra">ultra</SelectItem>
                              <SelectItem value="high">high</SelectItem>
                              <SelectItem value="medium">medium</SelectItem>
                              <SelectItem value="low">low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-1 py-1">
                          <Label className="text-foreground text-sm font-medium">
                            {translate("Auto Rotate")}
                          </Label>
                          <Switch
                            checked={props.autoRotate}
                            onCheckedChange={props.setAutoRotate}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 px-1 py-1">
                          <Label className="text-foreground text-sm font-medium">
                            {translate("Cloud Shadow")}
                          </Label>
                          <Switch
                            checked={props.cloudShadow}
                            onCheckedChange={props.setCloudShadow}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 px-1 py-1">
                          <Label className="text-foreground text-sm font-medium">
                            {props.waterSurfaceLabel}
                          </Label>
                          <Switch
                            checked={props.waterSurface}
                            onCheckedChange={props.setWaterSurface}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
