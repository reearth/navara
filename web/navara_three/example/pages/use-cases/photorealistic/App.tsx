import { DefaultPlugin } from "@navara/three_default_plugin";
import { ViewProvider } from "@navara/three_react";
// import { StrictMode } from "react";
import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";

import { NightProvider } from "./NightContext";
import { PhotorealisticScene } from "./PhotorealisticScene";

import { useDarkMode } from "@/components/hooks/useDarkMode";

export const App = () => {
  useDarkMode({ storageKey: "navara:uc-photoreal" });
  const defaultPlugin = useMemo(() => new DefaultPlugin(), []);
  const plugins = useMemo(() => [defaultPlugin], [defaultPlugin]);
  return (
    // TODO: Use strict mode
    // <StrictMode>
    <ViewProvider
      shadow
      animation
      hideUnderground={false}
      waterTexture={{ enabled: true }}
      plugins={plugins}
    >
      <NightProvider>
        <PhotorealisticScene defaultPlugin={defaultPlugin} />
      </NightProvider>
    </ViewProvider>
    // </StrictMode>
  );
};

const rootEl = document.getElementById("main");
invariant(rootEl, "#main not found");
createRoot(rootEl).render(<App />);
