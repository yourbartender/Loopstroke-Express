import React, { useState, useEffect } from "react";
import {
  PenTool,
  Sparkles,
  Feather,
  Spline,
  Pencil,
  SprayCan,
  Circle,
  FlipHorizontal,
  Leaf,
  Grid,
  Droplets,
} from "lucide-react";
import { EXPRESS_BRUSHES } from "../engine/brushes";
import type { ExpressEngine } from "../engine/engine";
import { FloatBox } from "./FloatBox";

interface BrushDockProps {
  engine: ExpressEngine;
}

const BRUSH_ICONS: Record<string, React.FC<{ className?: string }>> = {
  PenTool,
  Sparkles,
  Feather,
  Spline,
  Pencil,
  SprayCan,
  Circle,
  Leaf,
  Grid,
  Droplets,
};

export const BrushDock: React.FC<BrushDockProps> = ({ engine }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return engine.subscribe(() => setTick((t) => t + 1));
  }, [engine]);

  const p = engine.brushParams;
  const currentBrush = EXPRESS_BRUSHES.find((b) => b.id === p.brushId) || EXPRESS_BRUSHES[0]!;

  return (
    <FloatBox
      id="brushes"
      title="BRUSHES"
      defaultX={16}
      defaultY={68}
      width={280}
      right={
        <button
          onClick={(e) => {
            e.stopPropagation();
            p.flip = !p.flip;
            setTick((t) => t + 1);
          }}
          className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-all ${
            p.flip
              ? "bg-purple-500 text-white font-bold shadow-md shadow-purple-500/30"
              : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
          }`}
          title="Flip: Mirrors brush stamps across stroke direction (e.g. left/right leaves, angled teeth, chisel flips)"
        >
          <FlipHorizontal className="w-3 h-3" />
          <span>FLIP</span>
        </button>
      }
    >
      {/* Brush Grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-3 max-h-56 overflow-y-auto pr-1">
        {EXPRESS_BRUSHES.map((b) => {
          const IconComp = BRUSH_ICONS[b.icon] || Circle;
          const isSel = p.brushId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => {
                p.brushId = b.id;
                p.spacing = b.spacing;
                if (b.defaultBlend) {
                  engine.activeLayer.blend = b.defaultBlend;
                }
                setTick((t) => t + 1);
              }}
              className={`p-2 rounded-xl flex items-center gap-2 text-left transition-all ${
                isSel
                  ? "bg-purple-500/25 border border-purple-500/60 text-white shadow-lg shadow-purple-500/10"
                  : "bg-white/5 border border-transparent hover:bg-white/10 text-white/70"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isSel ? "bg-purple-500 text-white" : "bg-white/10 text-white/60"
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium truncate">{b.name}</span>
            </button>
          );
        })}
      </div>

      {/* Flip notice if active */}
      {p.flip && (
        <div className="mb-2.5 px-2 py-1 bg-purple-500/15 border border-purple-500/30 rounded-lg text-[10px] text-purple-300 font-mono flex items-center justify-between">
          <span>FLIP ACTIVE</span>
          <span className="text-white/60">Alternates stamps</span>
        </div>
      )}

      {/* Sliders */}
      <div className="space-y-2.5 pt-2 border-t border-white/10 font-mono text-[11px]">
        {/* Size */}
        <div>
          <div className="flex justify-between text-white/60 mb-1">
            <span>SIZE</span>
            <span className="text-purple-400 font-bold">{Math.round(p.size)}px</span>
          </div>
          <input
            type="range"
            min={2}
            max={140}
            value={p.size}
            onChange={(e) => {
              p.size = parseFloat(e.target.value);
              setTick((t) => t + 1);
            }}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>

        {/* Opacity */}
        <div>
          <div className="flex justify-between text-white/60 mb-1">
            <span>OPACITY</span>
            <span className="text-purple-400 font-bold">{Math.round(p.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1.0}
            step={0.05}
            value={p.opacity}
            onChange={(e) => {
              p.opacity = parseFloat(e.target.value);
              setTick((t) => t + 1);
            }}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>

        {/* Spacing */}
        <div>
          <div className="flex justify-between text-white/60 mb-1">
            <span>SPACING</span>
            <span className="text-purple-400 font-bold">
              {Math.round(p.spacing * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.015}
            max={0.25}
            step={0.005}
            value={p.spacing}
            onChange={(e) => {
              p.spacing = parseFloat(e.target.value);
              setTick((t) => t + 1);
            }}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>

        {/* Jitter */}
        <div>
          <div className="flex justify-between text-white/60 mb-1">
            <span>JITTER</span>
            <span className="text-purple-400 font-bold">{Math.round(p.jitter * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1.0}
            step={0.05}
            value={p.jitter}
            onChange={(e) => {
              p.jitter = parseFloat(e.target.value);
              setTick((t) => t + 1);
            }}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>
      </div>
    </FloatBox>
  );
};
