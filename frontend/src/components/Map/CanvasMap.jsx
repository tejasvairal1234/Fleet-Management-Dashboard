// components/Map/CanvasMap.jsx
import { useEffect, useRef, useCallback, useState } from "react";
import { useFleet } from "../../hooks/useFleet";
import { STATUS_COLORS, STATUS_GLOW, STATUS_LABELS, needsAttention } from "../../utils/status";

const DEFAULT_SITE_WIDTH  = 900;
const DEFAULT_SITE_HEIGHT = 560;

export function CanvasMap({ onRobotClick }) {
  const { robots, selectedRobotId } = useFleet();

  const containerRef    = useRef(null);
  const canvasRef       = useRef(null);
  const mapImageRef     = useRef(null);
  const siteWidthRef    = useRef(DEFAULT_SITE_WIDTH);
  const siteHeightRef   = useRef(DEFAULT_SITE_HEIGHT);

  const [imageLoaded, setImageLoaded]       = useState(false);
  const [zoomDisplay, setZoomDisplay]       = useState(100);
  const [hoveredRobotId, setHoveredRobotId] = useState(null);
  const [cursorStyle, setCursorStyle]       = useState("grab");

  // Single unified transform for both layout.png and robot coordinates
  const transformRef = useRef({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    zoomLevel: 1.0,
    baseFitScale: 1.0,
    initialFitDone: false,
  });

  // Pan / Drag state
  const isDraggingRef  = useRef(false);
  const dragStartRef   = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const hasMovedRef    = useRef(false);

  // Load layout.png image
  useEffect(() => {
    const img = new Image();
    img.src = "/layout.png";
    img.onload = () => {
      mapImageRef.current = img;
      siteWidthRef.current  = img.naturalWidth  || DEFAULT_SITE_WIDTH;
      siteHeightRef.current = img.naturalHeight || DEFAULT_SITE_HEIGHT;
      console.log("Site layout image loaded:", siteWidthRef.current, siteHeightRef.current);
      setImageLoaded(true);
    };
    img.onerror = (err) => {
      console.error("Failed to load /layout.png", err);
    };
    if (img.complete && img.naturalWidth > 0) {
      mapImageRef.current = img;
      siteWidthRef.current  = img.naturalWidth  || DEFAULT_SITE_WIDTH;
      siteHeightRef.current = img.naturalHeight || DEFAULT_SITE_HEIGHT;
      setImageLoaded(true);
    }
  }, []);

  // Fit site map to available container area
  const fitToSite = useCallback((customW, customH) => {
    const container = containerRef.current;
    if (!container) return;
    const w = customW || container.clientWidth || 0;
    const h = customH || container.clientHeight || 0;
    if (w <= 0 || h <= 0) return;

    const sw = siteWidthRef.current  || DEFAULT_SITE_WIDTH;
    const sh = siteHeightRef.current || DEFAULT_SITE_HEIGHT;
    const PADDING = 20;

    const s = Math.min((w - PADDING * 2) / sw, (h - PADDING * 2) / sh);
    const finalScale = s > 0 ? s : 1;

    const ox = (w - sw * finalScale) / 2;
    const oy = (h - sh * finalScale) / 2;

    transformRef.current = {
      scale: finalScale,
      offsetX: ox,
      offsetY: oy,
      zoomLevel: 1.0,
      baseFitScale: finalScale,
      initialFitDone: true,
    };
    setZoomDisplay(100);
  }, []);

  // Recalculate fit when image loads or container resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w > 0 && h > 0) {
        if (!transformRef.current.initialFitDone) {
          fitToSite(w, h);
        }
      }
    };

    updateSize();
    const obs = new ResizeObserver(updateSize);
    obs.observe(container);
    return () => obs.disconnect();
  }, [fitToSite, imageLoaded]);

  // Zoom centered around focal point (focalX, focalY in container coordinates)
  const zoomAt = useCallback((factor, focalX, focalY) => {
    const t = transformRef.current;
    const newZoomLevel = Math.max(0.3, Math.min(6.0, t.zoomLevel * factor));
    const actualFactor = newZoomLevel / t.zoomLevel;
    if (Math.abs(actualFactor - 1) < 0.001) return;

    const newScale = t.scale * actualFactor;
    const newOffsetX = focalX - (focalX - t.offsetX) * actualFactor;
    const newOffsetY = focalY - (focalY - t.offsetY) * actualFactor;

    transformRef.current = {
      ...t,
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY,
      zoomLevel: newZoomLevel,
    };
    setZoomDisplay(Math.round(newZoomLevel * 100));
  }, []);

  const handleZoomIn = useCallback(() => {
    const w = containerRef.current?.clientWidth || 0;
    const h = containerRef.current?.clientHeight || 0;
    zoomAt(1.25, w / 2, h / 2);
  }, [zoomAt]);

  const handleZoomOut = useCallback(() => {
    const w = containerRef.current?.clientWidth || 0;
    const h = containerRef.current?.clientHeight || 0;
    zoomAt(1 / 1.25, w / 2, h / 2);
  }, [zoomAt]);

  const handleReset = useCallback(() => {
    fitToSite();
  }, [fitToSite]);

  // Wheel zoom (non-passive to prevent page scroll)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAt(factor, mouseX, mouseY);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Canvas Click detection
  const handleCanvasClick = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { scale: s, offsetX: ox, offsetY: oy } = transformRef.current;
    const siteX = (clickX - ox) / s;
    const siteY = (clickY - oy) / s;
    const hitRadiusSite = 16 / s;

    let closest = null;
    let minDist = hitRadiusSite;

    for (let i = 0; i < robots.length; i++) {
      const r = robots[i];
      const dist = Math.hypot(r.x - siteX, r.y - siteY);
      if (dist < minDist) {
        minDist = dist;
        closest = r.robot_id;
      }
    }

    onRobotClick?.(closest);
  }, [robots, onRobotClick]);

  // Mouse pan / drag handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    hasMovedRef.current   = false;
    dragStartRef.current  = {
      x: e.clientX,
      y: e.clientY,
      ox: transformRef.current.offsetX,
      oy: transformRef.current.offsetY,
    };
    setCursorStyle("grabbing");
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
      }
      transformRef.current.offsetX = dragStartRef.current.ox + dx;
      transformRef.current.offsetY = dragStartRef.current.oy + dy;
      return;
    }

    // Hover detection over robot markers
    const { scale: s, offsetX: ox, offsetY: oy } = transformRef.current;
    const siteX = (screenX - ox) / s;
    const siteY = (screenY - oy) / s;
    const hitRadiusSite = 14 / s;

    let found = null;
    for (let i = 0; i < robots.length; i++) {
      const r = robots[i];
      const dist = Math.hypot(r.x - siteX, r.y - siteY);
      if (dist <= hitRadiusSite) {
        found = r.robot_id;
        break;
      }
    }
    setHoveredRobotId(found);
    setCursorStyle(found ? "pointer" : "grab");
  }, [robots]);

  const handleMouseUp = useCallback((e) => {
    if (isDraggingRef.current) {
      if (!hasMovedRef.current) {
        handleCanvasClick(e);
      }
      isDraggingRef.current = false;
      setCursorStyle(hoveredRobotId ? "pointer" : "grab");
    }
  }, [handleCanvasClick, hoveredRobotId]);

  // Focus on selected robot: center robot and zoom in
  useEffect(() => {
    if (!selectedRobotId || !containerRef.current) return;
    const robot = robots.find((r) => r.robot_id === selectedRobotId);
    if (!robot) return;

    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    if (w <= 0 || h <= 0) return;

    const baseFit = transformRef.current.baseFitScale || 1;
    const targetZoom = Math.max(transformRef.current.zoomLevel, 1.8);
    const targetScale = baseFit * targetZoom;

    transformRef.current = {
      ...transformRef.current,
      scale: targetScale,
      offsetX: w / 2 - robot.x * targetScale,
      offsetY: h / 2 - robot.y * targetScale,
      zoomLevel: targetZoom,
    };
    setZoomDisplay(Math.round(targetZoom * 100));
  }, [selectedRobotId, robots]);

  // Continuous Canvas render loop
  useEffect(() => {
    let animId;
    const render = () => {
      const canvas    = canvasRef.current;
      const container = containerRef.current;

      if (canvas && container) {
        const w = container.clientWidth;
        const h = container.clientHeight;

        if (w > 0 && h > 0) {
          const dpr = window.devicePixelRatio || 1;
          const targetW = Math.floor(w * dpr);
          const targetH = Math.floor(h * dpr);

          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width  = targetW;
            canvas.height = targetH;
          }

          const ctx = canvas.getContext("2d");
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, w, h);

          const { scale: s, offsetX: ox, offsetY: oy, zoomLevel: z } = transformRef.current;
          const sw = siteWidthRef.current  || DEFAULT_SITE_WIDTH;
          const sh = siteHeightRef.current || DEFAULT_SITE_HEIGHT;

          // 1. Draw layout.png background directly on canvas
          const img = mapImageRef.current;
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, ox, oy, sw * s, sh * s);
          } else {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(ox, oy, sw * s, sh * s);
          }

          // 2. Site boundary border
          ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
          ctx.lineWidth   = 1.5;
          ctx.strokeRect(ox, oy, sw * s, sh * s);

          // 3. Draw Robots
          const totalRobots   = robots.length;
          const showAllLabels = totalRobots <= 100;

          for (let i = 0; i < totalRobots; i++) {
            const robot = robots[i];
            const rx = robot.x * s + ox;
            const ry = robot.y * s + oy;

            // Frustum culling for extreme performance with 1000+ robots
            if (rx < -30 || rx > w + 30 || ry < -30 || ry > h + 30) {
              continue;
            }

            const isSelected = robot.robot_id === selectedRobotId;
            const isHovered  = robot.robot_id === hoveredRobotId;
            const attn       = needsAttention(robot);
            const color      = STATUS_COLORS[robot.status] || "#94a3b8";
            const glow       = STATUS_GLOW[robot.status]   || "rgba(148, 163, 184, 0.4)";

            const markerRadius = isSelected ? 7 : (isHovered ? 6 : 5);

            ctx.save();

            // Glow / Pulse Halo
            if (isSelected || isHovered || attn) {
              ctx.beginPath();
              ctx.arc(rx, ry, markerRadius + (isSelected ? 5 : 3), 0, Math.PI * 2);
              ctx.fillStyle = isSelected ? "rgba(255, 255, 255, 0.35)" : glow;
              ctx.fill();
            }

            // Outer ring
            if (isSelected) {
              ctx.beginPath();
              ctx.arc(rx, ry, markerRadius + 3, 0, Math.PI * 2);
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth   = 2;
              ctx.stroke();
            } else if (attn) {
              ctx.beginPath();
              ctx.arc(rx, ry, markerRadius + 2, 0, Math.PI * 2);
              ctx.strokeStyle = "#f59e0b";
              ctx.lineWidth   = 1.5;
              ctx.stroke();
            }

            // Robot Circle Body
            ctx.beginPath();
            ctx.arc(rx, ry, markerRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Inner core highlight
            ctx.beginPath();
            ctx.arc(rx, ry, Math.max(1.5, markerRadius * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
            ctx.fill();

            // Label rendering
            const shouldShowLabel = showAllLabels || isSelected || isHovered || attn;
            if (shouldShowLabel && z >= 0.45) {
              ctx.font = isSelected
                ? "bold 10px 'JetBrains Mono', monospace"
                : "9px 'JetBrains Mono', monospace";
              ctx.textAlign    = "center";
              ctx.textBaseline = "bottom";

              const text = robot.robot_id;
              const textW = ctx.measureText(text).width;
              const labelY = ry - markerRadius - 3;

              // Label backdrop pill
              ctx.fillStyle = "rgba(7, 11, 20, 0.85)";
              ctx.fillRect(rx - textW / 2 - 3, labelY - 11, textW + 6, 12);

              if (isSelected) {
                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth   = 1;
                ctx.strokeRect(rx - textW / 2 - 3, labelY - 11, textW + 6, 12);
                ctx.fillStyle   = "#ffffff";
              } else if (attn) {
                ctx.fillStyle   = "#f59e0b";
              } else {
                ctx.fillStyle   = "#e2e8f0";
              }

              ctx.fillText(text, rx, labelY);
            }

            ctx.restore();
          }

          ctx.restore();
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [robots, selectedRobotId, hoveredRobotId]);

  return (
    <div
      ref={containerRef}
      className="map-container"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Hardware-accelerated Canvas for layout and robots */}
      <canvas ref={canvasRef} className="map-canvas" />

      {/* Map controls */}
      <div className="map-controls">
        <button className="map-control-btn" onClick={handleZoomIn} title="Zoom In">+</button>
        <span className="map-zoom-label">{zoomDisplay}%</span>
        <button className="map-control-btn" onClick={handleZoomOut} title="Zoom Out">−</button>
        <button className="map-control-btn" onClick={handleReset} title="Reset / Fit View">⛶</button>
      </div>

      {/* Status legend */}
      <div className="map-legend">
        <div className="legend-title">Status Legend</div>
        <div className="legend-items">
          {[
            ["idle",        STATUS_COLORS.idle,        STATUS_LABELS.idle],
            ["active",      STATUS_COLORS.active,      STATUS_LABELS.active],
            ["on_mission",  STATUS_COLORS.on_mission,  STATUS_LABELS.on_mission],
            ["charging",    STATUS_COLORS.charging,    STATUS_LABELS.charging],
            ["blocked",     STATUS_COLORS.blocked,     STATUS_LABELS.blocked],
            ["error",       STATUS_COLORS.error,       STATUS_LABELS.error],
            ["maintenance", STATUS_COLORS.maintenance, STATUS_LABELS.maintenance],
            ["offline",     STATUS_COLORS.offline,     STATUS_LABELS.offline],
          ].map(([key, color, label]) => (
            <div key={key} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CanvasMap;
