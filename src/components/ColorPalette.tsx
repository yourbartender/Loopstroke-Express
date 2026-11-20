import React, { useState, useEffect } from "react";
import { Pipette, Shuffle, Dices } from "lucide-react";
import type { ExpressEngine } from "../engine/engine";

interface ColorPaletteProps {
  engine: ExpressEngine;
}

const PALETTE = [
  "#ffffff", // Pure White
  "#ef4444", // Crimson Red
  "#f97316", // Tangerine Orange
  "#facc15", // Bright Yellow
  "#22c55e", // Leaf Green
  "#06b6d4", // Electric Cyan
  "#3b82f6", // Cobalt Blue
  "#a855f7", // Vivid Purple
  "#ec4899", // Hot Magenta
  "#94a3b8", // Cool Silver
];

export const ColorPalette: React.FC<ColorPaletteProps> = ({ engine }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return engine.subscribe(() => setTick((t) => t + 1));
  }, [engine]);

  const activeColor = engine.brushParams.color.toLowerCase();

  return (
    <div className="fixed right-3 top-16 z-20 select-none">
      <div className="bg-[#111218]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-1.5 items-center">
        {/* Custom Color Input */}
        <label
          className="relative w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden border border-white/20 hover:scale-105 transition-transform"
          style={{ backgroundColor: activeColor }}
          title="Pick Custom Color"
        >
          <input
            type="color"
            value={activeColor}
            onChange={(e) => {
              engine.brushParams.color = e.target.value;
              engine.notifyChange();
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <Pipette className="w-3.5 h-3.5 text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] pointer-events-none" />
        </label>

        {/* Random Color Picker & Per-Stroke Auto Toggle */}
        <button
          onClick={() => engine.pickRandomColor()}
          className="w-8 h-7 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
          title="Pick Random Color"
        >
          <Shuffle className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            engine.randomColorPerStroke = !engine.randomColorPerStroke;
            engine.notifyChange();
          }}
          className={`w-8 py-1 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all ${
            engine.randomColorPerStroke
              ? "bg-pink-500/25 border-pink-400/60 text-pink-300 shadow-md shadow-pink-500/20"
              : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
          }`}
          title="Randomize color automatically on every new stroke"
        >
          <Dices className="w-3 h-3" />
          <span className="text-[8px] font-mono font-bold leading-none">AUTO</span>
        </button>

        <div className="w-5 h-px bg-white/10 my-0.5" />

        {/* Swatches */}
        <div className="flex flex-col gap-1.5">
          {PALETTE.map((hex) => {
            const isSel = activeColor === hex.toLowerCase();
            return (
              <button
                key={hex}
                onClick={() => {
                  engine.brushParams.color = hex;
                  engine.notifyChange();
                }}
                className={`w-7 h-7 rounded-lg transition-transform ${
                  isSel
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#111218] shadow-md"
                    : "hover:scale-105 opacity-85 hover:opacity-100"
                }`}
                style={{ backgroundColor: hex }}
                title={hex}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
