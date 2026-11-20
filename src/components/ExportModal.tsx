import React, { useState, useEffect, useRef } from "react";
import { Image, Video, Share2, Check, Loader2 } from "lucide-react";
import { exportPng, shareCanvas, VideoRecorder } from "../engine/export";
import type { ExpressEngine } from "../engine/engine";
import { FloatBox } from "./FloatBox";

interface ExportModalProps {
  engine: ExpressEngine;
  canvas: HTMLCanvasElement | null;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ engine, canvas, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [successMsg, setSuccessMsg] = useState("");
  const [, setTick] = useState(0);
  const timerRef = useRef<number | null>(null);
  const recorderRef = useRef<VideoRecorder | null>(null);

  useEffect(() => {
    return engine.subscribe(() => setTick((t) => t + 1));
  }, [engine]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      recorderRef.current?.cancelRecording();
    };
  }, []);

  const loopSec = engine.loopLength / 1000;

  const handleExportPng = () => {
    if (!canvas) return;
    exportPng(canvas);
    setSuccessMsg("Snapshot saved!");
    setTimeout(() => setSuccessMsg(""), 2500);
  };

  const handleShare = async () => {
    if (!canvas) return;
    await shareCanvas(canvas);
  };

  const handleRecordVideo = (loops = 1) => {
    if (!canvas || isRecording) return;
    setIsRecording(true);
    setRecordProgress(0);

    const recorder = new VideoRecorder();
    recorderRef.current = recorder;
    const started = recorder.startRecording(canvas, 60);
    if (!started) {
      alert("Video recording is not supported on this browser.");
      setIsRecording(false);
      recorderRef.current = null;
      return;
    }

    const durationMs = Math.max(500, engine.loopLength * loops);
    const startedAt = performance.now();

    timerRef.current = window.setInterval(async () => {
      const elapsed = performance.now() - startedAt;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setRecordProgress(pct);

      if (elapsed >= durationMs) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        try {
          const blob = await recorder.stopRecording();
          recorder.downloadVideo(blob, `loopstroke-${loops}x-loop`);
          setSuccessMsg(`Recorded ${loops} loop(s)!`);
          setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
          console.error("Recording error:", err);
        } finally {
          recorderRef.current = null;
          setIsRecording(false);
        }
      }
    }, 50);
  };

  const defaultX = typeof window !== "undefined" ? Math.max(16, Math.round((window.innerWidth - 340) / 2)) : 320;
  const defaultY = 84;

  return (
    <FloatBox
      id="export"
      title="EXPORT ARTWORK"
      defaultX={defaultX}
      defaultY={defaultY}
      width={340}
      onClose={onClose}
    >
      <p className="text-xs text-white/60 mb-4">
        Save crisp PNG stills or capture clean looping video.
      </p>

      {successMsg && (
        <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 font-mono">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="space-y-2">
        {/* PNG Snapshot */}
        <button
          onClick={handleExportPng}
          disabled={isRecording}
          className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Image className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold">Still Image (PNG)</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">Full Canvas</span>
        </button>

        {/* Record 1 Loop */}
        <button
          onClick={() => handleRecordVideo(1)}
          disabled={isRecording}
          className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Video className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold">Record 1 Loop</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">{loopSec.toFixed(1)}s</span>
        </button>

        {/* Record 2 Loops */}
        <button
          onClick={() => handleRecordVideo(2)}
          disabled={isRecording}
          className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Video className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-semibold">Record 2 Loops</span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">{(loopSec * 2).toFixed(1)}s</span>
        </button>

        {/* Share / Save to Photos */}
        <button
          onClick={handleShare}
          disabled={isRecording}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 disabled:opacity-50 border border-cyan-500/30 flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold">Share / Save</span>
          </div>
          <span className="text-[10px] text-cyan-400 font-mono">Share / Download</span>
        </button>
      </div>

      {/* Progress bar during recording */}
      {isRecording && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs font-mono text-purple-300 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>RECORDING LOOP...</span>
            </div>
            <span>{recordProgress}%</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-100"
              style={{ width: `${recordProgress}%` }}
            />
          </div>
        </div>
      )}
    </FloatBox>
  );
};
