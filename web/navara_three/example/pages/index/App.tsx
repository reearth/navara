import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";

import { PageList } from "./PageList";
import "./main.css";

export const App = () => {
  return <PageList />;
};

const root = document.getElementById("main");
invariant(root);
createRoot(root).render(<App />);
