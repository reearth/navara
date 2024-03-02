import ThreeView from "./lib/index.ts";
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
if (!canvas) throw new Error("canvas element not found");

const view = new ThreeView({
  canvas,
  debug: true,
});

await view.init();

ReactDOM.createRoot(document.getElementById('ui-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)