import React, { useRef, useEffect, useState } from "react";
import type { ExpressEngine } from "../engine/engine";
import { getBrush, tipMask } from "../engine/brushes";

interface CanvasViewProps {
  engine: ExpressEngine | null;
  onInitCanvas: (canvas: HTMLCanvasElement) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ engine, onInitCanvas }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<{ x: number; y: number; visible: boolean; lastResizeShow: number }>({
    x: 0,
    y: 0,
    visible: false,
    lastResizeShow: 0,
  });
  const lastSizeRef = useRef<number | null>(null);
  const lastBrushRef = useRef<string | null>(null);
  const [limitNotice, setLimitNotice] = useState("");

  // Multi-touch gesture tracking for Undo / Redo
  const gestureRef = useRef<{
    starts: Map<number, { x: number; y: number; time: number }>;
    maxTouches: number;
    cancelled: boolean;
  }>({
    starts: new Map(),
    maxTouches: 0,
    cancelled: false,
  });

  const drawBrushPreview = () => {
    const pCanvas = previewCanvasRef.current;
    if (!pCanvas || !engine) return;
    const ctx = pCanvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = pCanvas.getBoundingClientRect();
    const pw = Math.max(1, Math.round(rect.width * dpr));
    const ph = Math.max(1, Math.round(rect.height * dpr));
    if (pCanvas.width !== pw || pCanvas.height !== ph) {
      pCanvas.width = pw;
      pCanvas.height = ph;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const cur = cursorRef.current;
    const showFromResize = performance.now() - cur.lastResizeShow < 900;
    if (!cur.visible && !showFromResize) return;

    const cx = cur.visible ? cur.x : rect.width * 0.5;
    const cy = cur.visible ? cur.y : rect.height * 0.5;
    const brush = getBrush(engine.brushParams.brushId);
    const w = Math.max(2, engine.brushParams.size);
    const h = Math.max(2, w * brush.aspect);

    // Draw faint tinted tip silhouette so user sees exact shape & size
    const mask = tipMask(brush.tip);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.24;
    ctx.drawImage(mask, -w / 2, -h / 2, w, h);

    // Crisp outer perimeter guide
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1, w / 2 - 1), Math.max(1, h / 2 - 1), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onInitCanvas(canvas);

    const handleResize = () => {
      if (!canvas || !engine) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      engine.renderer.resize(rect.width, rect.height, dpr);
      drawBrushPreview();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [engine, onInitCanvas]);

  // Subscribe to brush size/shape changes & limit notices
  useEffect(() => {
    if (!engine) return;
    lastSizeRef.current = engine.brushParams.size;
    lastBrushRef.current = engine.brushParams.brushId;

    let hideTimer: number | null = null;
    const unsub = engine.subscribe(() => {
      setLimitNotice(engine.limitNotice);
      const sizeChanged = lastSizeRef.current !== engine.brushParams.size;
      const brushChanged = lastBrushRef.current !== engine.brushParams.brushId;
      if (sizeChanged || brushChanged) {
        lastSizeRef.current = engine.brushParams.size;
        lastBrushRef.current = engine.brushParams.brushId;
        cursorRef.current.lastResizeShow = performance.now();
        drawBrushPreview();
        if (hideTimer !== null) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => drawBrushPreview(), 950);
      } else {
        drawBrushPreview();
      }
    });

    return () => {
      unsub();
      if (hideTimer !== null) window.clearTimeout(hideTimer);
    };
  }, [engine]);

  // Two-finger trackpad scroll / pinch resizes brush size smoothly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      cursorRef.current.x = e.clientX - rect.left;
      cursorRef.current.y = e.clientY - rect.top;
      cursorRef.current.visible = true;
      cursorRef.current.lastResizeShow = performance.now();

      const sensitivity = e.ctrlKey ? 0.012 : 0.0045;
      const factor = Math.exp(-e.deltaY * sensitivity);
      engine.scaleBrushSize(factor);
      drawBrushPreview();
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [engine]);

  const updateCursorFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") {
      cursorRef.current.visible = false;
      drawBrushPreview();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    cursorRef.current.x = e.clientX - rect.left;
    cursorRef.current.y = e.clientY - rect.top;
    cursorRef.current.visible = true;
    drawBrushPreview();
  };

  // Touch handlers for multi-touch gestures (2-finger tap -> undo, 3-finger tap -> redo)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    const now = performance.now();
    if (e.touches.length >= 2) {
      engine?.cancelActiveStroke();
    }
    if (e.touches.length > g.maxTouches) {
      g.maxTouches = e.touches.length;
    }
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      g.starts.set(t.identifier, { x: t.clientX, y: t.clientY, time: now });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (g.maxTouches < 2 || g.cancelled) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      const start = g.starts.get(t.identifier);
      if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 22) {
        g.cancelled = true;
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    const now = performance.now();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      const start = g.starts.get(t.identifier);
      if (start) {
        const dt = now - start.time;
        const dist = Math.hypot(t.clientX - start.x, t.clientY - start.y);
        if (dt > 300 || dist > 22) {
          g.cancelled = true;
        }
        g.starts.delete(t.identifier);
      }
    }

    if (e.touches.length === 0) {
      if (!g.cancelled && engine) {
        if (g.maxTouches === 2) {
          engine.undo();
        } else if (g.maxTouches === 3) {
          engine.redo();
        }
      }
      g.maxTouches = 0;
      g.cancelled = false;
      g.starts.clear();
    }
  };

  const handleTouchCancel = () => {
    const g = gestureRef.current;
    g.maxTouches = 0;
    g.cancelled = false;
    g.starts.clear();
  };

  return (
    <main className="w-full h-full relative overflow-hidden bg-[#0a0a0c]">
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          updateCursorFromPointer(e);
          engine?.handlePointerDown(e);
        }}
        onPointerMove={(e) => {
          updateCursorFromPointer(e);
          engine?.handlePointerMove(e);
        }}
        onPointerLeave={() => {
          cursorRef.current.visible = false;
          drawBrushPreview();
        }}
        onPointerUp={(e) => engine?.handlePointerUp(e)}
        onPointerCancel={(e) => engine?.handlePointerUp(e)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="w-full h-full block cursor-crosshair touch-none"
        style={{
          touchAction: "none",
          WebkitTouchCallout: "none",
        }}
      />

      {/* Live Brush Size & Tip Shape Preview Overlay */}
      <canvas
        ref={previewCanvasRef}
        className="pointer-events-none absolute inset-0 w-full h-full"
      />

      {/* Stroke Limit Notice */}
      {limitNotice && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 font-mono text-xs shadow-xl backdrop-blur-md">
          {limitNotice}
        </div>
      )}
    </main>
  );
};
