// Curated, expressive brushes, tip masks, and custom PNG brush loader for Loopstroke Express
import type { ExpressBlendMode } from "./renderer";

export type SpinMode = "static" | "follow" | "flip";

export interface BrushDef {
  id: string;
  name: string;
  tip: string;
  icon: string;
  spacing: number;
  flow: number;
  sizeJitter: number;
  angleJitter: number;
  posJitter: number;
  spin: SpinMode;
  aspect: number;
  pressureSize: number;
  pressureAlpha: number;
  tiltSkew: number;
  defaultBlend?: ExpressBlendMode;
  flipAllowed?: boolean;
  isCustom?: boolean;
  previewUrl?: string;
}

export const MAX_CUSTOM_BRUSHES = 8;
const CUSTOM_BRUSH_STORAGE_KEY = "loopstroke_express_custom_brushes";

export const EXPRESS_BRUSHES: BrushDef[] = [
  {
    id: "hard",
    name: "Solid Round",
    tip: "hard",
    icon: "Circle",
    spacing: 0.035,
    flow: 1.0,
    sizeJitter: 0,
    angleJitter: 0,
    posJitter: 0,
    spin: "static",
    aspect: 1.0,
    pressureSize: 0.85,
    pressureAlpha: 0.0,
    tiltSkew: 0.1,
  },
  {
    id: "soft",
    name: "Soft Round",
    tip: "soft",
    icon: "CircleDot",
    spacing: 0.04,
    flow: 0.55,
    sizeJitter: 0,
    angleJitter: 0,
    posJitter: 0,
    spin: "static",
    aspect: 1.0,
    pressureSize: 0.8,
    pressureAlpha: 0.55,
    tiltSkew: 0.15,
  },
  {
    id: "water",
    name: "Wet Waterbrush",
    tip: "water",
    icon: "Waves",
    spacing: 0.055,
    flow: 0.24,
    sizeJitter: 0.12,
    angleJitter: Math.PI,
    posJitter: 0.04,
    spin: "static",
    aspect: 1.0,
    pressureSize: 0.75,
    pressureAlpha: 0.65,
    tiltSkew: 0.25,
  },
  {
    id: "calli",
    name: "Chisel Nib",
    tip: "calli",
    icon: "Feather",
    spacing: 0.025,
    flow: 0.95,
    sizeJitter: 0,
    angleJitter: 0,
    posJitter: 0,
    spin: "follow",
    aspect: 0.42,
    pressureSize: 0.7,
    pressureAlpha: 0.2,
    tiltSkew: 0.6,
    flipAllowed: true,
  },
  {
    id: "chalk",
    name: "Chalk Grain",
    tip: "chalk",
    icon: "Pencil",
    spacing: 0.045,
    flow: 0.72,
    sizeJitter: 0.08,
    angleJitter: 0.35,
    posJitter: 0.03,
    spin: "follow",
    aspect: 0.92,
    pressureSize: 0.65,
    pressureAlpha: 0.7,
    tiltSkew: 0.4,
  },
  {
    id: "spray",
    name: "Spray Paint",
    tip: "spray",
    icon: "SprayCan",
    spacing: 0.075,
    flow: 0.34,
    sizeJitter: 0.28,
    angleJitter: Math.PI,
    posJitter: 0.35,
    spin: "static",
    aspect: 1.0,
    pressureSize: 0.75,
    pressureAlpha: 0.6,
    tiltSkew: 0.2,
  },
  {
    id: "leaf",
    name: "Foliage Leaf",
    tip: "leaf",
    icon: "Leaf",
    spacing: 0.16,
    flow: 0.95,
    sizeJitter: 0.15,
    angleJitter: 0.1,
    posJitter: 0.08,
    spin: "flip",
    aspect: 1.0,
    pressureSize: 0.75,
    pressureAlpha: 0.2,
    tiltSkew: 0.3,
    flipAllowed: true,
  },
  {
    id: "rake",
    name: "Rake Comb",
    tip: "rake",
    icon: "Grid",
    spacing: 0.035,
    flow: 0.8,
    sizeJitter: 0,
    angleJitter: 0,
    posJitter: 0,
    spin: "follow",
    aspect: 1.0,
    pressureSize: 0.7,
    pressureAlpha: 0.4,
    tiltSkew: 0.4,
    flipAllowed: true,
  },
  {
    id: "splat",
    name: "Ink Splat",
    tip: "splat",
    icon: "Droplets",
    spacing: 0.14,
    flow: 0.85,
    sizeJitter: 0.35,
    angleJitter: 0.6,
    posJitter: 0.22,
    spin: "flip",
    aspect: 1.0,
    pressureSize: 0.85,
    pressureAlpha: 0.4,
    tiltSkew: 0.3,
    flipAllowed: true,
  },
  {
    id: "glow",
    name: "Neon Glow",
    tip: "soft",
    icon: "Sparkles",
    spacing: 0.04,
    flow: 0.35,
    sizeJitter: 0,
    angleJitter: 0,
    posJitter: 0,
    spin: "static",
    aspect: 1.0,
    pressureSize: 0.75,
    pressureAlpha: 0.5,
    tiltSkew: 0.2,
    defaultBlend: "add",
  },
];

const TIP = 512;
const maskCache = new Map<string, HTMLCanvasElement>();

interface StoredCustomBrush {
  id: string;
  name: string;
  dataUrl: string;
}

let customBrushes: BrushDef[] = [];
const brushListeners = new Set<() => void>();

function notifyBrushes() {
  for (const cb of brushListeners) cb();
}

export function subscribeBrushes(cb: () => void): () => void {
  brushListeners.add(cb);
  return () => brushListeners.delete(cb);
}

function blank(): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = TIP;
  c.height = TIP;
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, TIP, TIP);
  return { c, x };
}

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildMask(kind: string): HTMLCanvasElement {
  const { c, x } = blank();
  const r = TIP / 2;

  if (kind === "soft") {
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.42, "rgba(255,255,255,0.68)");
    g.addColorStop(0.78, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, TIP, TIP);
  } else if (kind === "hard") {
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.975, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.beginPath();
    x.arc(r, r, r, 0, Math.PI * 2);
    x.fill();
  } else if (kind === "water") {
    // Wet waterbrush: soft blotchy wash + subtle darker wet pigment pooling ring near outer boundary
    const rnd = seeded(7741);
    x.beginPath();
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const wobble = 0.8 + Math.sin(a * 3 + 0.7) * 0.06 + Math.cos(a * 5 - 1.2) * 0.05 + (rnd() - 0.5) * 0.05;
      const rr = r * 0.9 * wobble;
      const px = r + Math.cos(a) * rr;
      const py = r + Math.sin(a) * rr;
      if (i === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.closePath();

    const g = x.createRadialGradient(r, r, r * 0.1, r, r, r * 0.92);
    g.addColorStop(0, "rgba(255,255,255,0.42)");
    g.addColorStop(0.55, "rgba(255,255,255,0.52)");
    g.addColorStop(0.84, "rgba(255,255,255,0.92)");
    g.addColorStop(0.96, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fill();

    // Soft watery blooms inside
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2;
      const dist = rnd() * r * 0.52;
      const br = r * (0.16 + rnd() * 0.24);
      const cx = r + Math.cos(a) * dist;
      const cy = r + Math.sin(a) * dist;
      const bg = x.createRadialGradient(cx, cy, 0, cx, cy, br);
      bg.addColorStop(0, `rgba(255,255,255,${0.12 + rnd() * 0.14})`);
      bg.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = bg;
      x.beginPath();
      x.arc(cx, cy, br, 0, Math.PI * 2);
      x.fill();
    }
  } else if (kind === "calli") {
    // Smooth split-nib chisel tip with softened ends so curves flow cleanly
    const specs: Array<[number, number, number]> = [
      [TIP * 0.36, r * 0.82, r * 0.18],
      [TIP * 0.62, r * 0.64, r * 0.11],
    ];
    for (const [cy, rx, ry] of specs) {
      const g = x.createRadialGradient(r, cy, rx * 0.15, r, cy, rx);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.75, "rgba(255,255,255,0.92)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.save();
      x.translate(r, cy);
      x.rotate(0.12);
      x.scale(1, ry / rx);
      x.beginPath();
      x.arc(0, 0, rx, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  } else if (kind === "leaf") {
    // Organic leaf offset to one side of the stroke spine so FLIP alternates left/right along the stem
    x.fillStyle = "rgba(255,255,255,0.95)";
    x.beginPath();
    x.moveTo(TIP * 0.14, TIP * 0.56);
    x.quadraticCurveTo(TIP * 0.45, TIP * 0.06, TIP * 0.92, TIP * 0.18);
    x.quadraticCurveTo(TIP * 0.72, TIP * 0.58, TIP * 0.14, TIP * 0.56);
    x.closePath();
    x.fill();
    x.globalCompositeOperation = "destination-out";
    x.strokeStyle = "rgba(255,255,255,0.55)";
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(TIP * 0.18, TIP * 0.54);
    x.quadraticCurveTo(TIP * 0.54, TIP * 0.34, TIP * 0.86, TIP * 0.21);
    x.stroke();
    x.globalCompositeOperation = "source-over";
  } else if (kind === "rake") {
    const rnd = seeded(9021);
    const teeth = 6;
    for (let i = 0; i < teeth; i++) {
      const u = (i + 0.5) / teeth;
      const cy = TIP * (0.06 + u * 0.88) + (rnd() * 2 - 1) * 10;
      const rw = TIP * (0.045 + rnd() * 0.035);
      const rh = TIP * (0.028 + rnd() * 0.022);
      const g = x.createRadialGradient(r, cy, 0, r, cy, Math.max(rw, rh));
      g.addColorStop(0, `rgba(255,255,255,${0.75 + rnd() * 0.25})`);
      g.addColorStop(0.6, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(r + (rnd() * 2 - 1) * 8, cy, rw, rh, 0, 0, Math.PI * 2);
      x.fill();
    }
  } else if (kind === "splat") {
    const rnd = seeded(5150);
    x.fillStyle = "rgba(255,255,255,0.95)";
    x.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 16) {
      const rr = r * (0.3 + rnd() * 0.22 + Math.sin(a * 5) * 0.05);
      const px = r + Math.cos(a) * rr;
      const py = r + Math.sin(a) * rr;
      if (a === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    for (let i = 0; i < 34; i++) {
      const a = rnd() * Math.PI * 2;
      const d = r * (0.45 + Math.pow(rnd(), 0.5) * 0.5);
      const s = r * (0.015 + Math.pow(rnd(), 2) * 0.09);
      x.globalAlpha = 0.35 + rnd() * 0.65;
      x.beginPath();
      x.ellipse(r + Math.cos(a) * d, r + Math.sin(a) * d, s * (1 + rnd()), s, a, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;
  } else if (kind === "chalk") {
    // Dry textured pastel/chalk: solid organic paper-tooth grain with crumbly streaks (NOT spray dots)
    const rnd = seeded(4242);
    x.fillStyle = "rgba(255,255,255,0.92)";
    x.beginPath();
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const rr = r * (0.76 + (rnd() - 0.5) * 0.18);
      const px = r + Math.cos(a) * rr;
      const py = r + Math.sin(a) * rr;
      if (i === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.closePath();
    x.fill();

    // Carve paper-tooth grain & dry diagonal chalk ridges
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 420; i++) {
      const px = rnd() * TIP;
      const py = rnd() * TIP;
      const w = 4 + rnd() * 18;
      const h = 2 + rnd() * 6;
      x.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.65})`;
      x.save();
      x.translate(px, py);
      x.rotate(0.45 + (rnd() - 0.5) * 0.25);
      x.fillRect(-w / 2, -h / 2, w, h);
      x.restore();
    }
    x.globalCompositeOperation = "source-over";
  } else if (kind === "spray") {
    // True aerosol spray mist: soft misty core + dispersed fine micro-droplets
    const rnd = seeded(8080);
    const mist = x.createRadialGradient(r, r, 0, r, r, r * 0.88);
    mist.addColorStop(0, "rgba(255,255,255,0.28)");
    mist.addColorStop(0.5, "rgba(255,255,255,0.10)");
    mist.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = mist;
    x.fillRect(0, 0, TIP, TIP);

    for (let i = 0; i < 650; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.pow(rnd(), 0.72) * r * 0.96;
      const s = 0.7 + Math.pow(rnd(), 2.2) * 2.4;
      x.globalAlpha = (1 - d / r) * (0.2 + rnd() * 0.65);
      x.fillStyle = "#fff";
      x.beginPath();
      x.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, s, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;
  } else {
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, TIP, TIP);
  }

  return c;
}

function normalizeImageToMask(img: HTMLImageElement): { mask: HTMLCanvasElement; previewUrl: string } {
  const { c, x } = blank();
  const scale = Math.min((TIP * 0.9) / Math.max(1, img.width), (TIP * 0.9) / Math.max(1, img.height));
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (TIP - dw) / 2;
  const dy = (TIP - dh) / 2;
  x.drawImage(img, dx, dy, dw, dh);

  const imgData = x.getImageData(0, 0, TIP, TIP);
  const d = imgData.data;

  // Detect whether PNG uses alpha transparency or opaque luminance
  let transparentPixels = 0;
  let totalSampled = 0;
  for (let i = 3; i < d.length; i += 16) {
    totalSampled++;
    if (d[i]! < 235) transparentPixels++;
  }
  const hasAlphaMask = totalSampled > 0 && transparentPixels / totalSampled > 0.04;

  // For opaque images, inspect border brightness to tell black-on-white vs white-on-black
  let borderSum = 0;
  let borderCount = 0;
  if (!hasAlphaMask) {
    for (let px = 0; px < TIP; px += 8) {
      for (const py of [2, TIP - 3]) {
        const idx = (py * TIP + px) * 4;
        borderSum += (d[idx]! + d[idx + 1]! + d[idx + 2]!) / 3;
        borderCount++;
      }
    }
  }
  const lightBackground = !hasAlphaMask && borderCount > 0 && borderSum / borderCount > 140;

  for (let i = 0; i < d.length; i += 4) {
    let a = d[i + 3]!;
    if (!hasAlphaMask) {
      const lum = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      a = Math.round(lightBackground ? 255 - lum : lum);
    }
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = Math.max(0, Math.min(255, a));
  }
  x.putImageData(imgData, 0, 0);

  // Small 64x64 preview icon for the BrushDock button
  const prev = document.createElement("canvas");
  prev.width = 64;
  prev.height = 64;
  const pxCtx = prev.getContext("2d")!;
  pxCtx.drawImage(c, 0, 0, 64, 64);

  return { mask: c, previewUrl: prev.toDataURL("image/png") };
}

function saveCustomBrushesToStorage() {
  try {
    const payload: StoredCustomBrush[] = customBrushes.map((b) => ({
      id: b.id,
      name: b.name,
      dataUrl: maskCache.get(b.tip)?.toDataURL("image/png") || b.previewUrl || "",
    }));
    localStorage.setItem(CUSTOM_BRUSH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors
  }
}

function makeCustomBrushDef(id: string, name: string, previewUrl: string): BrushDef {
  return {
    id,
    name,
    tip: id,
    icon: "Image",
    spacing: 0.06,
    flow: 0.95,
    sizeJitter: 0,
    angleJitter: 0,
    posJitter: 0,
    spin: "follow",
    aspect: 1.0,
    pressureSize: 0.85,
    pressureAlpha: 0.15,
    tiltSkew: 0.2,
    flipAllowed: true,
    isCustom: true,
    previewUrl,
  };
}

export function loadCustomBrushesFromStorage() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(CUSTOM_BRUSH_STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as StoredCustomBrush[];
    if (!Array.isArray(list)) return;

    for (const item of list.slice(0, MAX_CUSTOM_BRUSHES)) {
      if (!item?.id || !item?.dataUrl) continue;
      const img = new Image();
      img.onload = () => {
        const { mask, previewUrl } = normalizeImageToMask(img);
        maskCache.set(item.id, mask);
        if (!customBrushes.some((b) => b.id === item.id)) {
          customBrushes.push(makeCustomBrushDef(item.id, item.name || "PNG Brush", previewUrl));
          notifyBrushes();
        }
      };
      img.src = item.dataUrl;
    }
  } catch {
    // Ignore parse errors
  }
}

export function importPngBrush(file: File): Promise<BrushDef | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const { mask, previewUrl } = normalizeImageToMask(img);
        const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
        const cleanName = file.name.replace(/\.[^.]+$/, "").slice(0, 18) || "PNG Brush";
        maskCache.set(id, mask);

        if (customBrushes.length >= MAX_CUSTOM_BRUSHES) {
          const removed = customBrushes.shift();
          if (removed) maskCache.delete(removed.tip);
        }

        const def = makeCustomBrushDef(id, cleanName, previewUrl);
        customBrushes.push(def);
        saveCustomBrushesToStorage();
        notifyBrushes();
        resolve(def);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function removeCustomBrush(id: string) {
  customBrushes = customBrushes.filter((b) => b.id !== id);
  maskCache.delete(id);
  saveCustomBrushesToStorage();
  notifyBrushes();
}

export function getAllBrushes(): BrushDef[] {
  return [...EXPRESS_BRUSHES, ...customBrushes];
}

export function tipMask(tip: string): HTMLCanvasElement {
  let m = maskCache.get(tip);
  if (!m) {
    m = buildMask(tip);
    maskCache.set(tip, m);
  }
  return m;
}

export function getBrush(id: string): BrushDef {
  return getAllBrushes().find((b) => b.id === id) || EXPRESS_BRUSHES[0]!;
}

loadCustomBrushesFromStorage();
