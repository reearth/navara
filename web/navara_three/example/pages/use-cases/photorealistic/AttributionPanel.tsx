import { Info, ChevronDown, ExternalLink } from "lucide-react";
import React from "react";

import { useI18n, type LanguageDictionary } from "./i18n";

import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export type Attribution = {
  name: string;
  description?: string;
  source?: string;
  url?: string;
  license?: string;
  licenseUrl?: string;
};

export type AttributionPanelProps = {
  attributions: Attribution[];
};

const LABELS = {
  "Data Sources": {
    ja: "データ出典",
  },
  "Open Details": {
    ja: "詳細を開く",
  },
  "Provider:": {
    ja: "提供元:",
  },
  "License:": {
    ja: "ライセンス:",
  },
} satisfies LanguageDictionary;

export function AttributionPanel({ attributions }: AttributionPanelProps) {
  const { translate } = useI18n(LABELS);
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80">
      <Card className="bg-card border-border shadow-lg overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <div className="w-full cursor-pointer hover:bg-accent transition-colors p-2 flex items-center gap-2">
              <Label className="flex-1 text-foreground text-sm font-medium cursor-pointer flex items-center gap-2">
                <Info className="w-4 h-4" />
                {translate("Data Sources")}
              </Label>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {attributions.length}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
              />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <Separator />
            <div className="p-3 space-y-3 max-h-[50vh] overflow-y-auto">
              {attributions.map((attr, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {attr.name}
                    </h4>
                    {attr.url && (
                      <a
                        href={attr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                        title={translate("Open Details")}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {attr.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {attr.description}
                    </p>
                  )}

                  {attr.source && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {translate("Provider:")}{" "}
                      </span>
                      {attr.source}
                    </p>
                  )}

                  {attr.license && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="font-medium">
                        {translate("License:")}{" "}
                      </span>
                      {attr.licenseUrl ? (
                        <a
                          href={attr.licenseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 underline"
                        >
                          {attr.license}
                        </a>
                      ) : (
                        <span>{attr.license}</span>
                      )}
                    </div>
                  )}

                  {idx < attributions.length - 1 && (
                    <Separator className="mt-2" />
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
