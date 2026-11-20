import React, { useState, useEffect, useRef } from "react";
import { GripVertical, Minus, Square, X } from "lucide-react";

interface FloatBoxProps {
  id: string;
  title: string;
  defaultX?: number;
  defaultY?: number;
  width?: number;
  children: React.ReactNode;
  right?: React.ReactNode;
  onClose?: () => void;
}

export const FloatBox: React.FC<FloatBoxProps> = ({
  id,
  title,
  defaultX = 16,
  defaultY = 64,
  width = 270,
  children,
  right,
  onClose,
}) => {
  const clampToViewport = (p: { x: number; y: number }) => {
    if (typeof window === "undefined") return p;
    const maxX = Math.max(8, window.innerWidth - 120);
    const maxY = Math.max(52, window.innerHeight - 60);
    return {
      x: Math.max(8, Math.min(p.x, maxX)),
      y: Math.max(52, Math.min(p.y, maxY)),
    };
  };

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(`loopstroke_express_${id}_pos`);
      if (saved) return clampToViewport(JSON.parse(saved));
    } catch {
      // Ignore
    }
    return clampToViewport({ x: defaultX, y: defaultY });
  });

  const [shrunk, setShrunk] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  // Clamp position to viewport on resize
  useEffect(() => {
    const handleResize = () => {
      setPos((p) => clampToViewport(p));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement)?.closest("button, input, select, textarea, a, [data-no-drag]")) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    const newPos = clampToViewport({
      x: dragRef.current.initX + dx,
      y: dragRef.current.initY + dy,
    });
    setPos(newPos);
    try {
      localStorage.setItem(`loopstroke_express_${id}_pos`, JSON.stringify(newPos));
    } catch {
      // Ignore
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${width}px`,
      }}
      className="fixed z-30 select-none shadow-2xl rounded-2xl bg-[#111218]/95 backdrop-blur-xl border border-white/10 overflow-hidden"
    >
      {/* Draggable Title Header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="h-10 px-3 bg-white/5 border-b border-white/10 flex items-center justify-between cursor-move touch-none"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-white/40" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-purple-400">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {right}
          <button
            onClick={() => setShrunk(!shrunk)}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title={shrunk ? "Expand" : "Minimize"}
          >
            {shrunk ? <Square className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body Controls (kept mounted so state is preserved) */}
      <div className={`p-3 transition-all ${shrunk ? "hidden" : "block"}`}>
        {children}
      </div>
    </div>
  );
};
