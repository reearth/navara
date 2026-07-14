import "../index/globals.css";

import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";

import { DetailApp } from "./DetailApp";

const root = document.getElementById("main");
invariant(root);
createRoot(root).render(<DetailApp />);
