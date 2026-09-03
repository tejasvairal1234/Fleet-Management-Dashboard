// App.jsx
import { useFleet } from "./hooks/useFleet";
import { Header }           from "./components/Layout/Header";
import { KpiCards }         from "./components/Stats/KpiCards";
import { Sidebar }          from "./components/Robots/Sidebar";
import { CanvasMap }        from "./components/Map/CanvasMap";
import { RobotDetailPanel } from "./components/Robots/RobotDetailPanel";
import { ActiveFleetChart } from "./components/Charts/ActiveFleetChart";
import { AdminPanel }       from "./components/Common/AdminPanel";
import { useCallback }      from "react";

function Dashboard() {
  const { selectedRobotId, setSelectedRobot, showAdminPanel } = useFleet();

  const handleRobotClick = useCallback((id) => {
    setSelectedRobot(id);
  }, [setSelectedRobot]);

  const handleFocus = useCallback((id) => {
    setSelectedRobot(id);
  }, [setSelectedRobot]);

  return (
    <div className="app">
      <Header />
      <KpiCards />
      <div className="body">
        <Sidebar />
        <div className="content">
          <div className="map-area">
            <CanvasMap onRobotClick={handleRobotClick} />
            {selectedRobotId && (
              <RobotDetailPanel onFocus={handleFocus} />
            )}
          </div>
          <ActiveFleetChart />
        </div>
      </div>
      {showAdminPanel && <AdminPanel />}
    </div>
  );
}

export default function App() {
  return <Dashboard />;
}
