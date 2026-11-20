import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Feather,
  Pencil,
  SprayCan,
  Circle,
  CircleDot,
  Waves,
  FlipHorizontal,
  Leaf,
  Grid,
  Droplets,
  ImagePlus,
  X,
} from "lucide-react";
import {
  getAllBrushes,
  importPngBrush,
  removeCustomBrush,
  subscribeBrushes,
  MAX_CUSTOM_BRUSHES,
} from "../engine/brushes";
import { ExpressEngine } from "../engine/engine";
import { FloatBox } from "./FloatBox";

interface BrushDockProps {
  engine: ExpressEngine;
}

const BRUSH_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Sparkles,
  Feather,
  Pencil,
  SprayCan,
  Circle,
  CircleDot,
  Waves,
  Leaf,
  Grid,
  Droplets,
};

export const BrushDock: React.FC<BrushDockProps> = ({ engine }) => {
  const [, setTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubEng = engine.subscribe(() => setTick((t) => t + 1));
    const unsubBrushes = subscribeBrushes(() => setTick((t) => t + 1));
    return () => {
      unsubEng();
      unsubBrushes();
    };
  }, [engine]);

  const brushes = getAllBrushes();
  const p = engine.brushParams;
  const customCount = brushes.filter((b) => b.isCustom).length;

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    let lastImportedId: string | null = null;
    for (const file of files) {
      const def = await importPngBrush(file);
      if (def) {
        engine.renderer.invalidateTipTexture(def.tip);
        lastImportedId = def.id;
      }
    }
    if (lastImportedId) {
      const imported = getAllBrushes().find((b) => b.id === lastImportedId);
      if (imported) {
        p.brushId = imported.id;
        p.spacing = imported.spacing;
        engine.notifyChange();
      }
    }
    e.target.value = "";
  };

  return (
    <FloatBox
      id="brushes"
      title="BRUSHES"
      defaultX={16}
      defaultY={68}
      width={284}
      right={
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition-all"
            title={`Import PNG brush tips (${customCount}/${MAX_CUSTOM_BRUSHES} slots used)`}
          >
            <ImagePlus className="w-3 h-3 text-cyan-400" />
            <span>PNG</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              p.flip = !p.flip;
              engine.notifyChange();
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-all ${
              p.flip
                ? "bg-purple-500 text-white font-bold shadow-md shadow-purple-500/30"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            title="Flip: Mirrors brush stamps across stroke direction"
          >
            <FlipHorizontal className="w-3 h-3" />
            <span>FLIP</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/*"
            multiple
            onChange={handleImportFiles}
            className="hidden"
          />
        </div>
      }
    >
      {/* Brush Grid (no forced scrollbar for the 10 built-in brushes) */}
      <div
        className={`grid grid-cols-2 gap-1.5 mb-3 ${
          brushes.length > 12 ? "max-h-72 overflow-y-auto pr-1" : ""
        }`}
      >
        {brushes.map((b) => {
          const IconComp = BRUSH_ICONS[b.icon] || Circle;
          const isSel = p.brushId === b.id;
          return (
            <div key={b.id} className="relative group">
              <button
                onClick={() => {
                  p.brushId = b.id;
                  p.spacing = b.spacing;
                  if (b.defaultBlend) {
                    engine.activeLayer.blend = b.defaultBlend;
                  }
                  engine.notifyChange();
                }}
                className={`w-full p-2 rounded-xl flex items-center gap-2 text-left transition-all ${
                  isSel
                    ? "bg-purple-500/25 border border-purple-500/60 text-white shadow-lg shadow-purple-500/10"
                    : "bg-white/5 border border-transparent hover:bg-white/10 text-white/70"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                    isSel ? "bg-purple-500 text-white" : "bg-white/10 text-white/60"
                  }`}
                >
                  {b.isCustom && b.previewUrl ? (
                    <img
                      src={b.previewUrl}
                      alt={b.name}
                      className="w-4 h-4 object-contain"
                    />
                  ) : (
                    <IconComp className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-xs font-medium truncate">{b.name}</span>
              </button>

              {b.isCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    engine.renderer.invalidateTipTexture(b.tip);
                    removeCustomBrush(b.id);
                    if (p.brushId === b.id) {
                      p.brushId = "hard";
                      p.spacing = 0.035;
                    }
                    engine.notifyChange();
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 border border-white/20 text-white/70 hover:text-red-400 hidden group-hover:flex items-center justify-center"
                  title="Remove custom PNG brush"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
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
            max={ExpressEngine.MAX_BRUSH_SIZE}
            value={p.size}
            onChange={(e) => {
              engine.setBrushSize(parseFloat(e.target.value));
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
              engine.notifyChange();
            }}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>

        {/* Spacing */}
        <div>
          <div className="flex justify-between text-white/60 mb-1">
            <span>SPACING</span>
            <span className="text-purple-400 font-bold">{Math.round(p.spacing * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.015}
            max={0.25}
            step={0.005}
            value={p.spacing}
            onChange={(e) => {
              p.spacing = parseFloat(e.target.value);
              engine.notifyChange();
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
              engine.notifyChange();
            }}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>
      </div>
    </FloatBox>
  );
};
