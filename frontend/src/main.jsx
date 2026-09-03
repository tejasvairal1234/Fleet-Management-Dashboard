// main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FleetProvider } from "./context/FleetContext";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FleetProvider>
      <App />
    </FleetProvider>
  </StrictMode>
);
