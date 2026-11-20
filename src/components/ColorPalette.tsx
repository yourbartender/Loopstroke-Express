import React, { useState, useEffect } from "react";
import { Pipette } from "lucide-react";
import type { ExpressEngine } from "../engine/engine";

interface ColorPaletteProps {
  engine: ExpressEngine;
}

const PALETTE = [
  "#06b6d4", // Cyan
  "#ec4899", // Neon Pink
  "#a855f7", // Purple
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#f43f5e", // Coral
  "#ffffff", // White
  "#38bdf8", // Sky Blue
  "#eab308", // Yellow
  "#8b5cf6", // Violet
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
              setTick((t) => t + 1);
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <Pipette className="w-3.5 h-3.5 text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] pointer-events-none" />
        </label>

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
                  setTick((t) => t + 1);
                }}
                className={`w-7 h-7 rounded-lg transition-transform ${
                  isSel
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#111218] shadow-md"
                    : "hover:scale-105 opacity-80 hover:opacity-100"
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
