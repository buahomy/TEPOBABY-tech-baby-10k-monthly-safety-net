import React from "react";
import ReactDOM from "react-dom/client";
import Mess01 from "./pages/Mess01";

// For now the whole site is the Figma welcome screen (served at / and /mess-01 alike).
// The full app (./App + ./styles.css) is kept in the repo; render <App /> here to bring it back.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Mess01 />
  </React.StrictMode>,
);

// Service worker only in production builds; in dev it would cache stale modules.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
