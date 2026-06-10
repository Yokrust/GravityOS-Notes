import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app/App.js";
import { StoreProvider } from "./lib/store.js";
import "./ui/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
);
