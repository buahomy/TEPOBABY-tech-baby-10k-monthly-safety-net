import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Mess01 from "./pages/Mess01";
import "./styles.css";

// Tiny path switch until we need a real router.
const path = window.location.pathname.replace(/\/+$/, "");
const Root = path === "/mess-01" ? Mess01 : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
