import React, { useRef, useEffect } from "react";
import type { ExpressEngine } from "../engine/engine";

interface CanvasViewProps {
  engine: ExpressEngine | null;
  onInitCanvas: (canvas: HTMLCanvasElement) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ engine, onInitCanvas }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onInitCanvas(canvas);

    const handleResize = () => {
      if (!canvas || !engine) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      engine.renderer.resize(rect.width, rect.height, dpr);
    };

    window.addEventListener("resize", handleResize);
    // Initial call
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [engine, onInitCanvas]);

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
        onPointerDown={(e) => engine?.handlePointerDown(e)}
        onPointerMove={(e) => engine?.handlePointerMove(e)}
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
    </main>
  );
};
