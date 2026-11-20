import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Zap,
  Repeat,
  ArrowLeftRight,
  Shield,
  Sparkles,
} from "lucide-react";
import type { ExpressEngine, LoopMode } from "../engine/engine";

interface TopBarProps {
  engine: ExpressEngine;
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ engine, onOpenExport }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return engine.subscribe(() => setTick((t) => t + 1));
  }, [engine]);

  // Tap tempo helper
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const handleTapTempo = () => {
    const now = performance.now();
    const recent = [...tapTimes.filter((t) => now - t < 2500), now];
    setTapTimes(recent);
    if (recent.length >= 2) {
      const intervals = [];
      for (let i = 1; i < recent.length; i++) {
        intervals.push(recent[i]! - recent[i - 1]!);
      }
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgMs);
      engine.setBpm(Math.max(40, Math.min(240, bpm)));
    }
  };

  const currentMode = engine.activeLayer.mode || engine.loopMode;

  return (
    <header className="min-h-14 py-1.5 bg-[#111218]/90 backdrop-blur-md border-b border-white/10 px-3 md:px-5 flex flex-wrap items-center justify-between gap-2 z-30 select-none">
      {/* Brand & Transport */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-bold text-sm tracking-wide hidden lg:inline text-white">
            LOOPSTROKE <span className="text-cyan-400 font-mono text-xs font-normal">EXPRESS</span>
          </span>
        </div>

        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        {/* Play / Pause */}
        <button
          onClick={() => {
            engine.isPlaying = !engine.isPlaying;
            setTick((t) => t + 1);
          }}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all ${
            engine.isPlaying
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30"
              : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
          title={engine.isPlaying ? "Pause Loop (Space)" : "Play Loop (Space)"}
        >
          {engine.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{engine.isPlaying ? "PLAY" : "PAUSE"}</span>
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => engine.undo()}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Undo (Ctrl/Cmd+Z or 2-finger tap)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => engine.redo()}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Redo (Ctrl/Cmd+Shift+Z or 3-finger tap)"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center: Looping Modes & Loop Length */}
      <div className="flex items-center gap-2 md:gap-3 font-mono text-xs">
        {/* Mode Selector: LOOP | PING-PONG | HOLD */}
        <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => engine.setLoopMode("loop")}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              currentMode === "loop"
                ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                : "text-white/60 hover:text-white"
            }`}
            title="Loop Mode: Plays stroke forward and loops continuously"
          >
            <Repeat className="w-3 h-3" />
            <span>LOOP</span>
          </button>

          <button
            onClick={() => engine.setLoopMode("pingpong")}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              currentMode === "pingpong"
                ? "bg-purple-500 text-white font-bold shadow-md shadow-purple-500/20"
                : "text-white/60 hover:text-white"
            }`}
            title="Ping-Pong Mode: Plays forward then backward back and forth"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>PING-PONG</span>
          </button>

          <button
            onClick={() => engine.setLoopMode("hold")}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              currentMode === "hold"
                ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20"
                : "text-white/60 hover:text-white"
            }`}
            title="Hold Mode: Full stroke stays permanently on screen (static)"
          >
            <Shield className="w-3 h-3" />
            <span>HOLD</span>
          </button>
        </div>

        {/* Loop Duration Selector */}
        <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10">
          <span className="hidden sm:inline text-[10px] text-white/40 px-1.5 uppercase font-bold">CYCLE:</span>
          {[1, 2, 4, 8].map((sec) => {
            const isSel = Math.abs(engine.loopLength - sec * 1000) < 50;
            return (
              <button
                key={sec}
                onClick={() => engine.setLoopLengthSec(sec)}
                className={`px-2 py-0.5 rounded-lg text-[11px] transition-all ${
                  isSel ? "bg-white/20 text-white font-bold" : "text-white/50 hover:text-white"
                }`}
                title={`Set loop cycle to ${sec} second(s)`}
              >
                {sec}s
              </button>
            );
          })}
        </div>

        {/* Trail Decay Slider */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-black/50 px-2 sm:px-2.5 py-1 rounded-xl border border-white/10">
          <div className="flex items-center gap-1 text-[10px] text-white/50 uppercase font-bold">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">TRAIL:</span>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            step={0.25}
            value={engine.trailSec}
            onChange={(e) => {
              engine.trailSec = parseFloat(e.target.value);
              setTick((t) => t + 1);
            }}
            className="w-16 sm:w-20 accent-cyan-400 cursor-pointer"
            title="Trail length in seconds (0 = full persistent loop)"
          />
          <span className="text-[10px] text-cyan-400 font-mono w-10 sm:w-12 text-right">
            {engine.trailSec === 0 ? "FULL" : `${engine.trailSec.toFixed(1)}s`}
          </span>
        </div>

        {/* BPM Input & Tap Tempo */}
        <div className="hidden md:flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-xl border border-white/10">
          <button
            onClick={handleTapTempo}
            className="text-[10px] text-white/50 hover:text-cyan-400 font-bold uppercase tracking-wider px-1"
            title="Tap Tempo"
          >
            TAP
          </button>
          <input
            type="number"
            min={40}
            max={240}
            value={engine.bpm}
            onChange={(e) => engine.setBpm(Number(e.target.value))}
            className="w-10 bg-transparent text-center font-bold text-white focus:outline-none"
          />
          <span className="text-[10px] text-white/40">BPM</span>
        </div>
      </div>

      {/* Clear & Export */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (confirm("Clear all strokes from canvas?")) {
              engine.clearAll();
            }
          }}
          className="p-2 rounded-xl hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
          title="Clear Canvas"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenExport}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>EXPORT</span>
        </button>
      </div>
    </header>
  );
};
