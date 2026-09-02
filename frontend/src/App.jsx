import { useState, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { RobotList } from './components/RobotList';
import { SiteMap } from './components/SiteMap';
import { RobotDetail } from './components/RobotDetail';
import { TrendChart } from './components/TrendChart';
import { AdminPanel } from './components/AdminPanel';
import { useFleetState } from './hooks/useFleetState';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [chartCollapsed, setChartCollapsed] = useState(false);

  const siteMapRef = useRef(null);

  const { robots, generation, stats, lastUpdate, applySnapshot, applyUpdate } = useFleetState();

  const { connectionStatus } = useWebSocket(
    useCallback((robotsArr) => applySnapshot(robotsArr), [applySnapshot]),
    useCallback((robot) => applyUpdate(robot), [applyUpdate])
  );

  const selectedRobot = selectedId ? robots.get(selectedId) : null;

  const handleSelectRobot = useCallback((id) => {
    setSelectedId(id);
    if (id && robots.has(id)) {
      const r = robots.get(id);
      if (r && siteMapRef.current?.centerOn) {
        siteMapRef.current.centerOn(r.x, r.y);
      }
    }
  }, [robots]);

  const handleFocusOnMap = useCallback((x, y) => {
    if (siteMapRef.current?.centerOn) {
      siteMapRef.current.centerOn(x, y);
    }
  }, []);

  const handleStatFilter = (key) => {
    const map = {
      total: null,
      working: 'working',
      idle: 'idle',
      charging: 'charging',
      attention: 'attention',
      offline: 'offline',
    };
    setStatusFilter(key ? map[key] : null);
  };

  return (
    <div className="app-viewport">
      {/* 1. Header Bar */}
      <Header
        connectionStatus={connectionStatus}
        robotCount={stats.total}
        lastUpdate={lastUpdate}
        onAdminClick={() => setShowAdmin(true)}
      />

      {/* 2. KPI Stats Bar */}
      <StatsBar
        stats={stats}
        activeFilter={statusFilter}
        onFilter={handleStatFilter}
      />

      {/* 3. Main Workspace Area */}
      <main className="main-workspace">
        {/* Left Sidebar */}
        <RobotList
          robots={robots}
          selectedId={selectedId}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onSearch={setSearchQuery}
          onFilter={setStatusFilter}
          onSelect={handleSelectRobot}
        />

        {/* Center/Right Primary Visual Area: Site Map */}
        <section className="primary-map-section">
          <SiteMap
            ref={siteMapRef}
            robots={robots}
            generation={generation}
            selectedId={selectedId}
            onSelectRobot={handleSelectRobot}
          />

          {/* Floating Robot Detail Panel */}
          {selectedRobot && (
            <RobotDetail
              robot={selectedRobot}
              onClose={() => setSelectedId(null)}
              onFocusOnMap={handleFocusOnMap}
            />
          )}
        </section>
      </main>

      {/* 4. Bottom Collapsible Trend Chart Dock */}
      <TrendChart
        stats={stats}
        isCollapsed={chartCollapsed}
        onToggleCollapse={() => setChartCollapsed(!chartCollapsed)}
      />

      {/* Admin Modal */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
