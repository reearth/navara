import { ViewProvider } from "@navara/three_react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";

import { Layers } from "./Layers";

export const App = () => {
  return (
    <StrictMode>
      <ViewProvider shadow debug>
        <Layers />
      </ViewProvider>
    </StrictMode>
  );
};

const rootEl = document.getElementById("main");
invariant(rootEl, "#main not found");
createRoot(rootEl).render(<App />);
