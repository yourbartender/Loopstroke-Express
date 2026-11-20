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
import type { ExpressEngine } from "../engine/engine";

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
    <header className="h-14 shrink-0 bg-[#111218]/90 backdrop-blur-md border-b border-white/10 px-2.5 md:px-4 flex flex-nowrap items-center justify-between gap-2 z-30 select-none overflow-x-auto">
      {/* Brand & Transport */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-bold text-sm tracking-wide hidden xl:inline text-white whitespace-nowrap">
            LOOPSTROKE <span className="text-cyan-400 font-mono text-xs font-normal">EXPRESS</span>
          </span>
        </div>

        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        {/* Play / Pause (fixed width so toggling PLAY <-> PAUSE never shifts layout) */}
        <button
          onClick={() => {
            engine.isPlaying = !engine.isPlaying;
            engine.notifyChange();
          }}
          className={`px-2.5 sm:w-[82px] py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 ${
            engine.isPlaying
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30"
              : "bg-white/10 text-white/70 border border-transparent hover:bg-white/20"
          }`}
          title={engine.isPlaying ? "Pause Loop (Space)" : "Play Loop (Space)"}
        >
          {engine.isPlaying ? <Pause className="w-3.5 h-3.5 shrink-0" /> : <Play className="w-3.5 h-3.5 shrink-0" />}
          <span className="hidden sm:inline">{engine.isPlaying ? "PLAY" : "PAUSE"}</span>
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 shrink-0">
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
      <div className="flex items-center gap-1.5 md:gap-2.5 font-mono text-xs shrink-0">
        {/* Mode Selector: LOOP | PING-PONG | HOLD */}
        <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            onClick={() => engine.setLoopMode("loop")}
            className={`px-2 md:px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
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
            className={`px-2 md:px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
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
            className={`px-2 md:px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
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
        <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10 shrink-0">
          <span className="hidden lg:inline text-[10px] text-white/40 px-1.5 uppercase font-bold">CYCLE:</span>
          {[1, 2, 4, 8].map((sec) => {
            const isSel = Math.abs(engine.loopLength - sec * 1000) < 50;
            return (
              <button
                key={sec}
                onClick={() => engine.setLoopLengthSec(sec)}
                className={`px-1.5 md:px-2 py-0.5 rounded-lg text-[11px] transition-all ${
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
        <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-xl border border-white/10 shrink-0">
          <div className="flex items-center gap-1 text-[10px] text-white/50 uppercase font-bold">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="hidden lg:inline">TRAIL:</span>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            step={0.25}
            value={engine.trailSec}
            onChange={(e) => {
              engine.trailSec = parseFloat(e.target.value);
              engine.notifyChange();
            }}
            className="w-16 md:w-20 accent-cyan-400 cursor-pointer"
            title="Trail length in seconds (0 = full persistent loop)"
          />
          <span className="text-[10px] text-cyan-400 font-mono w-10 text-right">
            {engine.trailSec === 0 ? "FULL" : `${engine.trailSec.toFixed(1)}s`}
          </span>
        </div>

        {/* BPM Input & Tap Tempo */}
        <div className="hidden lg:flex items-center gap-1 bg-black/50 px-2 py-1 rounded-xl border border-white/10 shrink-0">
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
            className="w-9 bg-transparent text-center font-bold text-white focus:outline-none"
          />
          <span className="text-[10px] text-white/40">BPM</span>
        </div>
      </div>

      {/* Clear & Export */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => engine.clearAll()}
          className="p-2 rounded-xl hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
          title="Clear All Layers (Undo restores)"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenExport}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition-all whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>EXPORT</span>
        </button>
      </div>
    </header>
  );
};
