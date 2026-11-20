// Core Animation & Looping Engine for Loopstroke Express
import type React from "react";
import { ExpressGLRenderer, type ExpressBlendMode } from "./renderer";
import { getBrush } from "./brushes";

interface NativeTabletBridge {
  pressure: number;
  tiltX: number;
  tiltY: number;
  rotation: number;
  active: boolean;
  time: number;
}

declare global {
  interface Window {
    __LOOPSTROKE_TABLET__?: NativeTabletBridge;
  }
}

export type LoopMode = "loop" | "pingpong" | "hold";

export interface StrokePoint {
  x: number; // Pixels
  y: number; // Pixels
  p: number; // Pressure 0..1
  tiltX: number;
  tiltY: number;
  t: number; // Milliseconds from stroke start
  h?: number; // Heading angle radians
}

export interface BakedStamp {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  fx: number;
  fy: number;
  r: number;
  g: number;
  b: number;
  a: number;
  t: number; // ms from stroke start
}

export interface RecordedStroke {
  id: string;
  brushId: string;
  colorHex: string;
  colorRgb: [number, number, number];
  size: number;
  opacity: number;
  spacing: number;
  jitter: number;
  flip: boolean;
  points: StrokePoint[];
  stamps: BakedStamp[];
  duration: number; // Total stroke duration ms
  loopStart: number; // Layer clock when stroke began ms
  createdClock: number; // Master clock when stroke finished ms
}

export interface LayerState {
  id: number;
  name: string;
  opacity: number;
  blend: ExpressBlendMode;
  visible: boolean;
  mode: LoopMode;
  strokes: RecordedStroke[];
}

export interface BrushParams {
  brushId: string;
  size: number;
  opacity: number;
  spacing: number;
  jitter: number;
  flip: boolean;
  color: string; // Hex color
}

export class ExpressEngine {
  public renderer!: ExpressGLRenderer;
  private canvas!: HTMLCanvasElement;

  // Master Transport
  public isPlaying = true;
  public clock = 0; // Master transport clock ms
  public bpm = 120;
  public loopLength = 4000; // 4.0 seconds ms
  public loopMode: LoopMode = "loop";
  public trailSec = 0; // 0 = Full loop (hold), > 0 = comet trail in seconds (e.g. 1.0s)

  // Layers
  public layers: LayerState[] = [
    { id: 1, name: "Layer 1", opacity: 1.0, blend: "normal", visible: true, mode: "loop", strokes: [] },
    { id: 2, name: "Layer 2", opacity: 1.0, blend: "add", visible: true, mode: "loop", strokes: [] },
    { id: 3, name: "Layer 3", opacity: 1.0, blend: "screen", visible: true, mode: "loop", strokes: [] },
    { id: 4, name: "Layer 4", opacity: 1.0, blend: "multiply", visible: true, mode: "loop", strokes: [] },
  ];
  public activeLayerId = 1;

  // Active Brush
  public brushParams: BrushParams = {
    brushId: "ink",
    size: 32,
    opacity: 1.0,
    spacing: 0.03,
    jitter: 0,
    flip: false,
    color: "#06b6d4",
  };

  // Active in-flight stroke
  private isDrawing = false;
  private activePointerId: number | null = null;
  private activePoints: StrokePoint[] = [];
  private activeStamps: BakedStamp[] = [];
  private strokeStartTime = 0;
  private strokeStartEventTs = 0;
  private strokeLoopStart = 0;
  private lastStampDist = 0;
  private stampFlipCounter = 0;

  // History for Undo / Redo
  private history: LayerState[][] = [];
  private redoStack: LayerState[][] = [];

  // Frame timing
  private rafId: number | null = null;
  private lastNow = 0;
  private listeners = new Set<() => void>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new ExpressGLRenderer(canvas);
    this.pushHistory();
    this.startLoop();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) cb();
  }

  public get activeLayer(): LayerState {
    return this.layers.find((l) => l.id === this.activeLayerId) || this.layers[0]!;
  }

  public notifyChange() {
    this.notify();
  }

  public setLayerMode(layerId: number, mode: LoopMode) {
    const layer = this.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.mode = mode;
    this.loopMode = mode;
    this.notify();
  }

  public setLoopMode(mode: LoopMode) {
    this.loopMode = mode;
    for (const l of this.layers) {
      l.mode = mode;
    }
    this.notify();
  }

  public setLoopLengthSec(sec: number) {
    this.loopLength = Math.max(500, Math.round(sec * 1000));
    this.notify();
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(40, Math.min(240, newBpm));
    // 4 beats default length
    const beatMs = (60 / this.bpm) * 1000;
    this.loopLength = Math.round(beatMs * 4);
    this.notify();
  }

  public pushHistory() {
    const snap = this.layers.map((l) => ({
      ...l,
      strokes: [...l.strokes],
    }));
    this.history.push(snap);
    if (this.history.length > 30) this.history.shift();
    this.redoStack = [];
    this.notify();
  }

  public undo() {
    if (this.history.length <= 1) return;
    const cur = this.history.pop()!;
    this.redoStack.push(cur);
    const prev = this.history[this.history.length - 1]!;
    this.layers = prev.map((l) => ({
      ...l,
      strokes: [...l.strokes],
    }));
    this.notify();
  }

  public redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop()!;
    this.history.push(next);
    this.layers = next.map((l) => ({
      ...l,
      strokes: [...l.strokes],
    }));
    this.notify();
  }

  public clearActiveLayer() {
    this.pushHistory();
    this.activeLayer.strokes = [];
    this.renderer.clearLayer(this.activeLayerId);
    this.notify();
  }

  public clearAll() {
    this.pushHistory();
    for (const l of this.layers) {
      l.strokes = [];
      this.renderer.clearLayer(l.id);
    }
    this.notify();
  }

  public parseColor(hex: string): [number, number, number] {
    let clean = hex.replace("#", "");
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    const num = parseInt(clean, 16);
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  }

  private sampleStylus(
    pointerType: string,
    pressure: number,
    tiltX: number,
    tiltY: number,
  ): { p: number; tiltX: number; tiltY: number } {
    if (pointerType === "pen") {
      return {
        p: Math.max(0.05, pressure || 0.5),
        tiltX: tiltX || 0,
        tiltY: tiltY || 0,
      };
    }
    const tb = typeof window !== "undefined" ? window.__LOOPSTROKE_TABLET__ : undefined;
    if (tb && tb.active && Date.now() / 1000 - tb.time < 0.2) {
      return {
        p: Math.max(0.05, tb.pressure),
        tiltX: tb.tiltX || 0,
        tiltY: tb.tiltY || 0,
      };
    }
    return { p: 0.8, tiltX: tiltX || 0, tiltY: tiltY || 0 };
  }

  public cancelActiveStroke() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.activePointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.activePointerId);
      } catch {
        // Ignore
      }
      this.activePointerId = null;
    }
    this.activePoints = [];
    this.activeStamps = [];
  }

  // Pointer & Stylus Handlers
  public handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (this.isDrawing) return;
    this.activePointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { p, tiltX, tiltY } = this.sampleStylus(e.pointerType, e.pressure, e.tiltX || 0, e.tiltY || 0);

    this.isDrawing = true;
    this.strokeStartTime = performance.now();
    this.strokeStartEventTs = e.timeStamp || this.strokeStartTime;
    this.strokeLoopStart = this.layerPhase(this.activeLayer);
    this.lastStampDist = 0;
    this.stampFlipCounter = 0;

    const pt0: StrokePoint = { x, y, p, tiltX, tiltY, t: 0 };
    this.activePoints = [pt0];
    this.activeStamps = [];

    // First stamp immediately
    this.addPointStamps(pt0, pt0, true);
  }

  public handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!this.isDrawing || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) return;

    const native = e.nativeEvent;
    const coalesced = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : null;
    const events: PointerEvent[] = coalesced && coalesced.length > 0 ? coalesced : [native];
    const rect = this.canvas.getBoundingClientRect();

    for (const ev of events) {
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const { p, tiltX, tiltY } = this.sampleStylus(ev.pointerType, ev.pressure, ev.tiltX || 0, ev.tiltY || 0);
      const last = this.activePoints[this.activePoints.length - 1]!;
      const rawT = ev.timeStamp ? ev.timeStamp - this.strokeStartEventTs : performance.now() - this.strokeStartTime;
      const t = Math.max(last.t, rawT);

      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.hypot(dx, dy);

      // Filter micro-noise jitter under 0.8px
      if (dist < 0.8 && this.activePoints.length > 1) continue;

      const heading = Math.atan2(dy, dx);
      const pt: StrokePoint = { x, y, p, tiltX, tiltY, t, h: heading };
      this.activePoints.push(pt);

      this.addPointStamps(last, pt, false);
    }
  }

  public handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!this.isDrawing || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) return;
    this.isDrawing = false;
    this.activePointerId = null;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (this.activePoints.length >= 1 && this.activeStamps.length > 0) {
      const duration = Math.max(100, this.activePoints[this.activePoints.length - 1]!.t);
      const [r, g, b] = this.parseColor(this.brushParams.color);

      // Auto-adapt loop length if this is the first stroke and duration is longer
      if (this.activeLayer.strokes.length === 0 && duration > this.loopLength * 0.8) {
        this.loopLength = Math.max(1000, Math.ceil(duration / 1000) * 1000);
      }

      // In ping-pong mode, keep strokeStart within [0, L - min(duration, L)] so the full stroke can unfold and rewind cleanly
      let loopStart = this.strokeLoopStart;
      if (this.activeLayer.mode === "pingpong" && this.loopLength > 0) {
        const clampedDur = Math.min(duration, this.loopLength);
        loopStart = Math.min(loopStart, Math.max(0, this.loopLength - clampedDur));
      }

      const stroke: RecordedStroke = {
        id: Math.random().toString(36).slice(2, 9),
        brushId: this.brushParams.brushId,
        colorHex: this.brushParams.color,
        colorRgb: [r, g, b],
        size: this.brushParams.size,
        opacity: this.brushParams.opacity,
        spacing: this.brushParams.spacing,
        jitter: this.brushParams.jitter,
        flip: this.brushParams.flip,
        points: [...this.activePoints],
        stamps: [...this.activeStamps],
        duration,
        loopStart,
        createdClock: this.clock,
      };

      this.pushHistory();
      this.activeLayer.strokes.push(stroke);
      this.notify();
    }

    this.activePoints = [];
    this.activeStamps = [];
  }

  private addPointStamps(p0: StrokePoint, p1: StrokePoint, isInitial: boolean) {
    const brush = getBrush(this.brushParams.brushId);
    const effSpacing = Math.max(0.015, this.brushParams.spacing);
    const baseSize = this.brushParams.size;
    const [r, g, b] = this.parseColor(this.brushParams.color);

    if (isInitial) {
      const size = baseSize * (1 - brush.pressureSize + brush.pressureSize * p0.p);
      const alpha = this.brushParams.opacity * (1 - brush.pressureAlpha + brush.pressureAlpha * p0.p) * brush.flow;
      const stamp: BakedStamp = {
        cx: p0.x,
        cy: p0.y,
        w: size,
        h: size * brush.aspect,
        angle: 0,
        fx: 1,
        fy: 1,
        r,
        g,
        b,
        a: alpha,
        t: p0.t,
      };
      this.activeStamps.push(stamp);
      return;
    }

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0) return;

    // Angle of travel
    const dir = Math.atan2(dy, dx);
    const avgPressure = (p0.p + p1.p) * 0.5;
    const effSize = baseSize * (1 - brush.pressureSize + brush.pressureSize * avgPressure);
    const step = Math.max(1.2, effSize * effSpacing);

    let d = this.lastStampDist > 0 ? Math.max(0.001, step - this.lastStampDist) : step;

    const effPosJitter = this.brushParams.jitter + brush.posJitter;
    const effSizeJitter = this.brushParams.jitter + brush.sizeJitter;
    const effAngleJitter = brush.angleJitter + this.brushParams.jitter * 0.6;

    while (d <= dist) {
      const u = d / dist;
      const x = p0.x + dx * u;
      const y = p0.y + dy * u;
      const p = p0.p + (p1.p - p0.p) * u;
      const t = p0.t + (p1.t - p0.t) * u;
      const tiltX = p0.tiltX + (p1.tiltX - p0.tiltX) * u;
      const tiltY = p0.tiltY + (p1.tiltY - p0.tiltY) * u;

      let size = baseSize * (1 - brush.pressureSize + brush.pressureSize * p);
      const alpha = this.brushParams.opacity * (1 - brush.pressureAlpha + brush.pressureAlpha * p) * brush.flow;

      // Jitter (combines user jitter slider with brush preset dynamics)
      let jx = 0;
      let jy = 0;
      if (effPosJitter > 0) {
        const jMag = effPosJitter * size * 0.35;
        jx = (Math.random() - 0.5) * 2 * jMag;
        jy = (Math.random() - 0.5) * 2 * jMag;
      }
      if (effSizeJitter > 0) {
        size *= Math.max(0.25, 1 + (Math.random() - 0.5) * effSizeJitter * 0.5);
      }

      // Heading / rotation
      let angle = brush.spin === "follow" || brush.spin === "flip" ? dir : 0;
      if (effAngleJitter > 0) {
        angle += (Math.random() - 0.5) * 2 * effAngleJitter;
      }

      // Flip calculation (mirrors across local stroke direction before rotation)
      let fx = 1;
      let fy = 1;
      if (this.brushParams.flip || brush.spin === "flip") {
        this.stampFlipCounter++;
        if (this.stampFlipCounter % 2 === 1) {
          fy = -1;
          if (brush.spin !== "follow" && brush.spin !== "flip") {
            fx = -1;
          }
        }
      }

      // Pen tilt skew
      let aspect = brush.aspect;
      if (brush.tiltSkew > 0 && (tiltX !== 0 || tiltY !== 0)) {
        const tiltMag = Math.hypot(tiltX, tiltY) / 90;
        aspect *= Math.max(0.2, 1 - tiltMag * brush.tiltSkew);
      }

      const stamp: BakedStamp = {
        cx: x + jx,
        cy: y + jy,
        w: size,
        h: size * aspect,
        angle,
        fx,
        fy,
        r,
        g,
        b,
        a: Math.max(0.01, Math.min(1.0, alpha)),
        t,
      };

      this.activeStamps.push(stamp);
      d += step;
    }

    this.lastStampDist = dist - (d - step);
  }

  // Playhead phase calculation per layer
  public layerPhase(layer: LayerState): number {
    const L = this.loopLength;
    if (L <= 0) return 0;
    const mode = layer.mode || this.loopMode;

    if (mode === "hold") {
      return L;
    }
    if (mode === "pingpong") {
      const u = this.clock % (L * 2);
      return u < L ? u : L * 2 - u;
    }
    // "loop"
    return this.clock % L;
  }

  // Main Render Loop
  private startLoop() {
    const tick = (nowMs: number) => {
      if (this.lastNow === 0) this.lastNow = nowMs;
      const dt = Math.min(100, nowMs - this.lastNow);
      this.lastNow = nowMs;

      if (this.isPlaying) {
        this.clock += dt;
      }

      // Render each layer into its WebGL FBO
      this.renderLayersFrame();

      // Composite onto screen canvas
      this.renderer.renderComposition(this.layers);

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private renderLayersFrame() {
    const L = this.loopLength;
    const trailMs = this.trailSec * 1000;

    for (const layer of this.layers) {
      if (!layer.visible) continue;
      const targetFb = this.renderer.getLayerFBO(layer.id).fb;
      this.renderer.clearLayer(layer.id);

      const playhead = this.layerPhase(layer);
      const isHold = layer.mode === "hold";
      const isPingPong = layer.mode === "pingpong";
      const goingForward = !isPingPong || L <= 0 || this.clock % (L * 2) < L;
      const hasTrail = trailMs > 0 && !isHold;

      // 1. Render recorded strokes
      for (const stroke of layer.strokes) {
        const brush = getBrush(stroke.brushId);
        this.renderer.beginStampBatch(brush.tip);

        const timeScale = L > 0 && stroke.duration > L ? L / stroke.duration : 1;
        const effectiveStart =
          isPingPong && L > 0 ? Math.min(stroke.loopStart, Math.max(0, L - stroke.duration * timeScale)) : stroke.loopStart;

        // Relative playhead position for this stroke
        const relHead = isHold
          ? stroke.duration
          : isPingPong
          ? playhead - effectiveStart
          : (playhead - stroke.loopStart + L) % L;

        for (let i = 0; i < stroke.stamps.length; i++) {
          const s = stroke.stamps[i]!;
          const st = s.t * timeScale;

          if (isHold) {
            // In Hold mode, draw all stamps permanently
            this.renderer.addStamp(
              s.cx,
              s.cy,
              s.w,
              s.h,
              s.angle,
              s.fx,
              s.fy,
              s.r,
              s.g,
              s.b,
              s.a,
            );
          } else if (hasTrail) {
            // Trail mode: comet window behind moving playhead
            if (isPingPong) {
              if (relHead >= 0) {
                const age = goingForward ? relHead - st : st - relHead;
                if (age >= 0 && age <= trailMs) {
                  const fade = 1.0 - age / trailMs;
                  this.renderer.addStamp(
                    s.cx,
                    s.cy,
                    s.w,
                    s.h,
                    s.angle,
                    s.fx,
                    s.fy,
                    s.r,
                    s.g,
                    s.b,
                    s.a * fade,
                  );
                }
              }
            } else {
              let age = relHead - st;
              if (age < 0 && L > 0 && this.clock - stroke.createdClock >= L) {
                age += L;
              }
              if (age >= 0 && age <= trailMs) {
                const fade = 1.0 - age / trailMs;
                this.renderer.addStamp(
                  s.cx,
                  s.cy,
                  s.w,
                  s.h,
                  s.angle,
                  s.fx,
                  s.fy,
                  s.r,
                  s.g,
                  s.b,
                  s.a * fade,
                );
              }
            }
          } else {
            // Full loop / pingpong mode: stroke unfolds up to current playhead
            if ((!isPingPong || relHead >= 0) && st <= relHead) {
              this.renderer.addStamp(
                s.cx,
                s.cy,
                s.w,
                s.h,
                s.angle,
                s.fx,
                s.fy,
                s.r,
                s.g,
                s.b,
                s.a,
              );
            }
          }
        }

        this.renderer.flushStamps(targetFb);
      }

      // 2. Render live in-flight stroke under artist's hand
      if (this.isDrawing && layer.id === this.activeLayerId && this.activeStamps.length > 0) {
        const brush = getBrush(this.brushParams.brushId);
        this.renderer.beginStampBatch(brush.tip);

        for (let i = 0; i < this.activeStamps.length; i++) {
          const s = this.activeStamps[i]!;
          this.renderer.addStamp(
            s.cx,
            s.cy,
            s.w,
            s.h,
            s.angle,
            s.fx,
            s.fy,
            s.r,
            s.g,
            s.b,
            s.a,
          );
        }

        this.renderer.flushStamps(targetFb);
      }
    }
  }

  public destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
