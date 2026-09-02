import { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { STATUS_COLORS, LEGEND_ITEMS, needsAttention } from '../utils/statusColors';

// Map image coordinate system dimensions (from layout.png)
const MAP_W = 900;
const MAP_H = 560;

const ROBOT_RADIUS = 7;
const SELECTED_RADIUS = 11;

export const SiteMap = forwardRef(function SiteMap(
  { robots, generation, selectedId, onSelectRobot },
  ref
) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const imgLoadedRef = useRef(false);

  const [zoomPercent, setZoomPercent] = useState(100);
  const [legendOpen, setLegendOpen] = useState(true);

  // Viewport transform state (mutable ref for 60fps RAF loop)
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, viewX: 0, viewY: 0, moved: false });
  const rafRef = useRef(null);

  const robotsRef = useRef(robots);
  const selectedIdRef = useRef(selectedId);
  robotsRef.current = robots;
  selectedIdRef.current = selectedId;

  // Fit map to container function
  const fitMap = useCallback((force = false) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    canvas.width = width;
    canvas.height = height;

    // Calculate scale to fit 900x560 with optimal margins
    const scaleX = width / MAP_W;
    const scaleY = height / MAP_H;
    const fitScale = Math.min(scaleX, scaleY) * 0.94;

    viewRef.current = {
      scale: fitScale,
      x: (width - MAP_W * fitScale) / 2,
      y: (height - MAP_H * fitScale) / 2,
    };
    setZoomPercent(Math.round(fitScale * 100));
  }, []);

  // Expose focus/center method via ref
  useImperativeHandle(ref, () => ({
    centerOn: (x, y) => {
      const container = containerRef.current;
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const targetScale = Math.max(1.4, viewRef.current.scale);

      viewRef.current = {
        scale: targetScale,
        x: width / 2 - x * targetScale,
        y: height / 2 - y * targetScale,
      };
      setZoomPercent(Math.round(targetScale * 100));
    },
    resetView: () => fitMap(true),
  }), [fitMap]);

  // Load layout image
  useEffect(() => {
    const img = new Image();
    img.src = '/layout.png';
    img.onload = () => {
      imgLoadedRef.current = true;
      imgRef.current = img;
      fitMap(true);
    };
    imgRef.current = img;
  }, [fitMap]);

  // ResizeObserver on container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    fitMap(true);
    const ro = new ResizeObserver(() => fitMap(false));
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitMap]);

  // Main Canvas Render Loop
  useEffect(() => {
    let running = true;

    function render(ts) {
      if (!running) return;
      rafRef.current = requestAnimationFrame(render);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { x: vx, y: vy, scale } = viewRef.current;
      const currentSelected = selectedIdRef.current;
      const pulse = (Math.sin(ts / 300) + 1) / 2; // 0..1 smooth wave

      // 1. Clear background
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw subtle workspace background grid
      ctx.save();
      ctx.fillStyle = '#080b11';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Transform to world map space
      ctx.translate(vx, vy);
      ctx.scale(scale, scale);

      // 3. Draw layout map
      if (imgLoadedRef.current && imgRef.current) {
        // Subtle drop shadow / boundary box around the site map
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 16 / scale;
        ctx.shadowOffsetY = 4 / scale;

        ctx.drawImage(imgRef.current, 0, 0, MAP_W, MAP_H);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Clean border around warehouse perimeter
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(0, 0, MAP_W, MAP_H);
      } else {
        // Fallback placeholder during load
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, MAP_W, MAP_H);
        ctx.strokeStyle = '#1e3a5f';
        ctx.lineWidth = 2 / scale;
        ctx.strokeRect(0, 0, MAP_W, MAP_H);
      }

      // 4. Draw coordinate origin marker (0,0)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = `${9 / scale}px JetBrains Mono, monospace`;
      ctx.fillText('(0,0)', 4, 12 / scale);

      // 5. Draw robots
      const robotsMap = robotsRef.current;

      for (const robot of robotsMap.values()) {
        const { x, y, status, robot_id, battery } = robot;
        const color = STATUS_COLORS[status] || '#64748b';
        const isSelected = robot_id === currentSelected;
        const isAttn = needsAttention(robot);
        const r = (isSelected ? SELECTED_RADIUS : ROBOT_RADIUS) / Math.max(0.6, Math.min(2.5, scale));

        // Attention warning halo
        if (isAttn) {
          ctx.beginPath();
          ctx.arc(x, y, r * (1.4 + pulse * 0.9), 0, Math.PI * 2);
          ctx.strokeStyle = `${color}${Math.floor((1 - pulse) * 200).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 2 / scale;
          ctx.stroke();
        }

        // Selected unit target reticle
        if (isSelected) {
          // Outer targeting ring
          ctx.beginPath();
          ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2 / scale;
          ctx.stroke();

          // Reticle tick marks
          const crossLen = 6 / scale;
          ctx.beginPath();
          ctx.moveTo(x - r * 2.8, y);
          ctx.lineTo(x - r * 2.8 + crossLen, y);
          ctx.moveTo(x + r * 2.8, y);
          ctx.lineTo(x + r * 2.8 - crossLen, y);
          ctx.moveTo(x, y - r * 2.8);
          ctx.lineTo(x, y - r * 2.8 + crossLen);
          ctx.moveTo(x, y + r * 2.8);
          ctx.lineTo(x, y + r * 2.8 - crossLen);
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 1.5 / scale;
          ctx.stroke();
        }

        // Robot dot body shadow/glow
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 12 / scale : 6 / scale;

        // Robot dot body
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // White border ring on robot dot
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = (isSelected ? 2 : 1) / scale;
        ctx.stroke();

        // Selected inner core
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }

        // ID & Status Pill Label (Rendered for selected robot or when zoomed in)
        if (isSelected || scale >= 1.2 || robotsMap.size <= 25) {
          ctx.save();
          const labelText = robot_id;
          const fontSize = Math.max(9, Math.min(13, 11 / scale));
          ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
          const textWidth = ctx.measureText(labelText).width;
          const padX = 4 / scale;
          const padY = 2 / scale;
          const labelH = fontSize + padY * 2;
          const labelW = textWidth + padX * 2;
          const labelY = y - r - labelH - (2 / scale);
          const labelX = x - labelW / 2;

          // Label background pill
          ctx.fillStyle = isSelected ? 'rgba(30, 58, 138, 0.92)' : 'rgba(15, 23, 42, 0.88)';
          ctx.strokeStyle = isSelected ? '#60a5fa' : 'rgba(100, 116, 139, 0.5)';
          ctx.lineWidth = 1 / scale;

          ctx.beginPath();
          ctx.roundRect(labelX, labelY, labelW, labelH, 3 / scale);
          ctx.fill();
          ctx.stroke();

          // Label text
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, x, labelY + labelH / 2);
          ctx.restore();
        }
      }

      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Mouse & Wheel Interaction Handlers ─────────────────────────────

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const view = viewRef.current;
    const newScale = Math.max(0.25, Math.min(10, view.scale * zoomFactor));
    const ratio = newScale / view.scale;

    view.x = mouseX - ratio * (mouseX - view.x);
    view.y = mouseY - ratio * (mouseY - view.y);
    view.scale = newScale;

    setZoomPercent(Math.round(newScale * 100));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // only left click
    const view = viewRef.current;
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      viewX: view.x,
      viewY: view.y,
      moved: false,
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag.dragging) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
    }

    const view = viewRef.current;
    view.x = drag.viewX + dx;
    view.y = drag.viewY + dy;
  }, []);

  const handleMouseUp = useCallback((e) => {
    const drag = dragRef.current;
    const wasDragging = drag.dragging;
    const didMove = drag.moved;
    drag.dragging = false;

    // Click handler for robot hit testing
    if (wasDragging && !didMove) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;

      const view = viewRef.current;
      const mapX = (clickScreenX - view.x) / view.scale;
      const mapY = (clickScreenY - view.y) / view.scale;

      const hitRadius = Math.max(14, 18 / view.scale);
      let closest = null;
      let closestDist = Infinity;

      for (const robot of robotsRef.current.values()) {
        const d = Math.hypot(robot.x - mapX, robot.y - mapY);
        if (d <= hitRadius && d < closestDist) {
          closest = robot;
          closestDist = d;
        }
      }

      onSelectRobot(closest ? closest.robot_id : null);
    }
  }, [onSelectRobot]);

  // Button Zoom Handlers
  const handleZoomIn = () => {
    const container = containerRef.current;
    if (!container) return;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const v = viewRef.current;
    const newScale = Math.min(10, v.scale * 1.25);
    const ratio = newScale / v.scale;
    v.x = cx - ratio * (cx - v.x);
    v.y = cy - ratio * (cy - v.y);
    v.scale = newScale;
    setZoomPercent(Math.round(newScale * 100));
  };

  const handleZoomOut = () => {
    const container = containerRef.current;
    if (!container) return;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const v = viewRef.current;
    const newScale = Math.max(0.25, v.scale / 1.25);
    const ratio = newScale / v.scale;
    v.x = cx - ratio * (cx - v.x);
    v.y = cy - ratio * (cy - v.y);
    v.scale = newScale;
    setZoomPercent(Math.round(newScale * 100));
  };

  return (
    <div className="map-panel" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="map-canvas-element"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current.dragging = false; }}
      />

      {/* Floating HUD Viewport Controls */}
      <div className="map-hud-controls">
        <button
          type="button"
          className="hud-ctrl-btn"
          onClick={handleZoomIn}
          title="Zoom In (+)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <span className="hud-zoom-badge" title="Current zoom level">
          {zoomPercent}%
        </span>

        <button
          type="button"
          className="hud-ctrl-btn"
          onClick={handleZoomOut}
          title="Zoom Out (-)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <button
          type="button"
          className="hud-ctrl-btn fit-btn"
          onClick={() => fitMap(true)}
          title="Reset to Fit View (⊡)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className={`map-legend-overlay${legendOpen ? ' is-open' : ' is-collapsed'}`}>
        <div className="legend-header" onClick={() => setLegendOpen(!legendOpen)}>
          <span className="legend-title">Status Legend</span>
          <button type="button" className="legend-toggle-btn">
            {legendOpen ? '▼' : '▲'}
          </button>
        </div>

        {legendOpen && (
          <div className="legend-grid">
            {LEGEND_ITEMS.map(({ status, label }) => (
              <div key={status} className="legend-entry">
                <span className="legend-swatch" style={{ background: STATUS_COLORS[status] }} />
                <span className="legend-label">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
