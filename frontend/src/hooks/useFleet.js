// hooks/useFleet.js
import { useContext } from "react";
import { FleetContext } from "../context/FleetContext";

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used inside FleetProvider");
  return ctx;
}
