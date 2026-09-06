import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@cloudscape-design/global-styles/index.css";
import "./app.css";
import App from "./App.js";
import { createFrankClient } from "./frank/client.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("The console could not start: no #root element in the page.");
}

createRoot(container).render(
  <StrictMode>
    <App client={createFrankClient()} />
  </StrictMode>,
);
