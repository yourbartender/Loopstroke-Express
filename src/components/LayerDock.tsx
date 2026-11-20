import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Trash2, Layers, Repeat, ArrowLeftRight, Shield } from "lucide-react";
import { ExpressEngine, type LoopMode } from "../engine/engine";
import type { ExpressBlendMode } from "../engine/renderer";

interface LayerDockProps {
  engine: ExpressEngine;
}

const BLEND_MODES: { id: ExpressBlendMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "add", label: "Add (Glow)" },
  { id: "difference", label: "Difference" },
  { id: "multiply", label: "Multiply" },
];

export const LayerDock: React.FC<LayerDockProps> = ({ engine }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return engine.subscribe(() => setTick((t) => t + 1));
  }, [engine]);

  const active = engine.activeLayer;

  const cycleMode = () => {
    const modes: LoopMode[] = ["loop", "pingpong", "hold"];
    const next = modes[(modes.indexOf(active.mode) + 1) % modes.length]!;
    engine.setLayerMode(active.id, next);
  };

  return (
    <footer className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 select-none">
      <div className="bg-[#111218]/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-2 md:gap-3 max-w-[95vw] overflow-x-auto">
        {/* Layer Icon */}
        <div className="hidden sm:flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] font-bold uppercase tracking-wider pl-1">
          <Layers className="w-3.5 h-3.5" />
          <span>LAYERS</span>
        </div>

        <div className="hidden sm:block h-5 w-px bg-white/10" />

        {/* Layer Buttons */}
        <div className="flex items-center gap-1.5">
          {engine.layers.map((l) => {
            const isSel = l.id === engine.activeLayerId;
            return (
              <button
                key={l.id}
                onClick={() => {
                  engine.activeLayerId = l.id;
                  engine.notifyChange();
                }}
                className={`relative px-3 py-1.5 rounded-xl font-mono text-xs flex items-center gap-1.5 transition-all ${
                  isSel
                    ? "bg-cyan-500 text-black font-bold shadow-lg shadow-cyan-500/20 scale-105"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>L{l.id}</span>
                {l.strokes.length > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-black" : "bg-cyan-400"}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-white/10" />

        {/* Blend Mode Dropdown */}
        <div className="flex items-center gap-1.5">
          <select
            value={active.blend}
            onChange={(e) => {
              active.blend = e.target.value as ExpressBlendMode;
              engine.notifyChange();
            }}
            className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            {BLEND_MODES.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#111218] text-white">
                {b.label}
              </option>
            ))}
          </select>
        </div>

        {/* Layer Mode Toggle */}
        <button
          onClick={cycleMode}
          className={`px-2 py-1 rounded-lg font-mono text-[11px] flex items-center gap-1 border transition-all ${
            active.mode === "loop"
              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
              : active.mode === "pingpong"
              ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
              : "bg-amber-500/20 text-amber-400 border-amber-500/30"
          }`}
          title="Toggle layer playback mode: Loop, Ping-Pong, or Hold"
        >
          {active.mode === "loop" ? (
            <Repeat className="w-3 h-3" />
          ) : active.mode === "pingpong" ? (
            <ArrowLeftRight className="w-3 h-3" />
          ) : (
            <Shield className="w-3 h-3" />
          )}
          <span className="uppercase font-bold">{active.mode}</span>
        </button>

        {/* Opacity Slider */}
        <div className="hidden md:flex items-center gap-2 font-mono text-[11px]">
          <span className="text-white/50">OPAC</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={active.opacity}
            onChange={(e) => {
              active.opacity = parseFloat(e.target.value);
              engine.notifyChange();
            }}
            className="w-16 accent-cyan-400 cursor-pointer"
          />
          <span className="text-cyan-400 w-8">{Math.round(active.opacity * 100)}%</span>
        </div>

        {/* Stroke count indicator */}
        <span
          className={`hidden sm:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 ${
            active.strokes.length >= ExpressEngine.MAX_STROKES_PER_LAYER
              ? "text-amber-300 border-amber-400/40"
              : "text-white/45"
          }`}
          title={`Strokes on Layer ${active.id} (max ${ExpressEngine.MAX_STROKES_PER_LAYER} per layer)`}
        >
          {active.strokes.length}/{ExpressEngine.MAX_STROKES_PER_LAYER}
        </span>

        {/* Visibility & Clear */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              active.visible = !active.visible;
              engine.notifyChange();
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              active.visible
                ? "text-white/70 hover:text-white hover:bg-white/10"
                : "text-red-400 bg-red-500/10"
            }`}
            title={active.visible ? "Hide Layer" : "Show Layer"}
          >
            {active.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => engine.clearActiveLayer()}
            className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={`Clear Layer ${active.id} (Undo restores)`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
