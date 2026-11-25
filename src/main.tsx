import "@fontsource-variable/outfit";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import "./design/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { isTauri } from "./core/platform/runtime";
import { setWindowChrome } from "./core/platform/window";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

setWindowChrome(isTauri() ? "floating" : "flat");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
