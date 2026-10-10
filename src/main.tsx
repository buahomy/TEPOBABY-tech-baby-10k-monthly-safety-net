import React from "react";
import ReactDOM from "react-dom/client";
import Tepobaby from "./Tepobaby";

// Welcome screen → .edu sign-in → onboarding questions → home (see ./Tepobaby.tsx).
// The earlier starter app (./App + ./styles.css) is kept in the repo but not rendered.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Tepobaby />
  </React.StrictMode>,
);

// Service worker only in production builds; in dev it would cache stale modules.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
