// hooks/useRobotFilters.js
import { useMemo } from "react";
import { needsAttention, isWorking, computeKPIs } from "../utils/status";

/**
 * Filters and searches the robots array.
 * Returns filtered list + counts for each filter tab.
 */
export function useRobotFilters(robots, filter, searchTerm) {
  const kpis = useMemo(() => computeKPIs(robots), [robots]);

  // Counts per filter tab (always computed from full list)
  const filterCounts = useMemo(() => ({
    all:       robots.length,
    attention: robots.filter(needsAttention).length,
    working:   robots.filter(isWorking).length,
    idle:      robots.filter((r) => r.status === "idle").length,
    charging:  robots.filter((r) => r.status === "charging").length,
    offline:   robots.filter((r) => r.status === "offline").length,
  }), [robots]);

  // Apply filter + search
  const filteredRobots = useMemo(() => {
    let result = robots;

    // Filter
    switch (filter) {
      case "attention": result = result.filter(needsAttention); break;
      case "working":   result = result.filter(isWorking); break;
      case "idle":      result = result.filter((r) => r.status === "idle"); break;
      case "charging":  result = result.filter((r) => r.status === "charging"); break;
      case "offline":   result = result.filter((r) => r.status === "offline"); break;
      default: break;
    }

    // Search
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.robot_id.toLowerCase().includes(term) ||
          (r.robot_type && r.robot_type.toLowerCase().includes(term))
      );
    }

    return result;
  }, [robots, filter, searchTerm]);

  return { filteredRobots, filterCounts, kpis };
}
