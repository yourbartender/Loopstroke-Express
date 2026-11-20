import React, { useState, useEffect, useRef, useCallback } from "react";
import { ExpressEngine } from "./engine/engine";
import { exportPng } from "./engine/export";
import { CanvasView } from "./components/CanvasView";
import { TopBar } from "./components/TopBar";
import { BrushDock } from "./components/BrushDock";
import { LayerDock } from "./components/LayerDock";
import { ColorPalette } from "./components/ColorPalette";
import { ExportModal } from "./components/ExportModal";

export const App: React.FC = () => {
  const [engine, setEngine] = useState<ExpressEngine | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const engineRef = useRef<ExpressEngine | null>(null);

  const initCanvas = useCallback((c: HTMLCanvasElement) => {
    if (engineRef.current) return;
    setCanvas(c);
    const eng = new ExpressEngine(c);
    engineRef.current = eng;
    setEngine(eng);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;

      // Don't intercept if inside an input
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;

      if (e.code === "Space") {
        e.preventDefault();
        eng.isPlaying = !eng.isPlaying;
        eng.notifyChange();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          eng.redo();
        } else {
          eng.undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        eng.redo();
      } else if (e.key >= "1" && e.key <= "4") {
        eng.activeLayerId = parseInt(e.key, 10);
        eng.notifyChange();
      } else if (e.key === "[") {
        eng.scaleBrushSize(0.88);
      } else if (e.key === "]") {
        eng.setBrushSize(Math.max(eng.brushParams.size + 2, Math.round(eng.brushParams.size * 1.14)));
      }
    };

    const onUndo = () => engineRef.current?.undo();
    const onRedo = () => engineRef.current?.redo();
    const onClear = () => engineRef.current?.clearAll();
    const onOpenExport = () => setExportOpen(true);
    const onExportPng = () => {
      if (canvas) exportPng(canvas);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("loopstroke:undo", onUndo);
    window.addEventListener("loopstroke:redo", onRedo);
    window.addEventListener("loopstroke:clear", onClear);
    window.addEventListener("loopstroke:open-export", onOpenExport);
    window.addEventListener("loopstroke:export-png", onExportPng);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("loopstroke:undo", onUndo);
      window.removeEventListener("loopstroke:redo", onRedo);
      window.removeEventListener("loopstroke:clear", onClear);
      window.removeEventListener("loopstroke:open-export", onOpenExport);
      window.removeEventListener("loopstroke:export-png", onExportPng);
    };
  }, [canvas]);

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#0a0a0c] select-none text-white font-sans">
      {/* Top Bar */}
      {engine && <TopBar engine={engine} onOpenExport={() => setExportOpen(true)} />}

      {/* Main Drawing Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <CanvasView engine={engine} onInitCanvas={initCanvas} />

        {/* Floating Side Docks */}
        {engine && (
          <>
            <BrushDock engine={engine} />
            <ColorPalette engine={engine} />
            <LayerDock engine={engine} />
          </>
        )}
      </div>

      {/* Export Modal */}
      {exportOpen && engine && (
        <ExportModal
          engine={engine}
          canvas={canvas}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
};
