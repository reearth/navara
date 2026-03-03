import { DefaultPlugin } from "@navara/three_default_plugin";
import { ViewProvider } from "@navara/three_react";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";

import { Layers } from "./Layers";

export const App = () => {
  const defaultPlugin = useMemo(() => new DefaultPlugin(), []);
  const plugins = useMemo(() => [defaultPlugin], [defaultPlugin]);
  return (
    <StrictMode>
      <ViewProvider shadow debug plugins={plugins}>
        <Layers defaultPlugin={defaultPlugin} />
      </ViewProvider>
    </StrictMode>
  );
};

const rootEl = document.getElementById("main");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}

console.log("Navara React integration test loaded successfully!");
console.log(
  "If you can see the 3D globe with buildings, the React library is working correctly.",
);
