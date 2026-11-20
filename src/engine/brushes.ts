// Curated, expressive brushes & tip masks for Loopstroke Express

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
  defaultBlend?: "normal" | "add" | "screen" | "multiply";
  flipAllowed?: boolean;
}

export const EXPRESS_BRUSHES: BrushDef[] = [
  {
    id: "ink",
    name: "Ink Pen",
    tip: "nib",
    icon: "PenTool",
    spacing: 0.03,
    flow: 1.0,
    sizeJitter: 0,
    angleJitter: 0,
    posJitter: 0,
    spin: "follow",
    aspect: 0.85,
    pressureSize: 0.95,
    pressureAlpha: 0.1,
    tiltSkew: 0.6,
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
    aspect: 0.3,
    pressureSize: 0.7,
    pressureAlpha: 0.2,
    tiltSkew: 0.8,
    flipAllowed: true,
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
    posJitter: 0.1,
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
    posJitter: 0.25,
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
  {
    id: "ribbon",
    name: "Flow Ribbon",
    tip: "nib",
    icon: "Spline",
    spacing: 0.02,
    flow: 0.7,
    sizeJitter: 0,
    angleJitter: 0,
    posJitter: 0,
    spin: "follow",
    aspect: 0.2,
    pressureSize: 0.8,
    pressureAlpha: 0.4,
    tiltSkew: 0.8,
  },
  {
    id: "chalk",
    name: "Chalk Grain",
    tip: "chalk",
    icon: "Pencil",
    spacing: 0.08,
    flow: 0.6,
    sizeJitter: 0.2,
    angleJitter: Math.PI,
    posJitter: 0.15,
    spin: "static",
    aspect: 1.0,
    pressureSize: 0.65,
    pressureAlpha: 0.75,
    tiltSkew: 0.4,
  },
  {
    id: "spray",
    name: "Spray Airbrush",
    tip: "spray",
    icon: "SprayCan",
    spacing: 0.09,
    flow: 0.45,
    sizeJitter: 0.3,
    angleJitter: 1.0,
    posJitter: 0.35,
    spin: "static",
    aspect: 1.0,
    pressureSize: 0.8,
    pressureAlpha: 0.6,
    tiltSkew: 0.2,
  },
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
];

const TIP = 512;
const maskCache = new Map<string, HTMLCanvasElement>();

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
    g.addColorStop(0.45, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, TIP, TIP);
  } else if (kind === "hard") {
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.992, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.beginPath();
    x.arc(r, r, r, 0, Math.PI * 2);
    x.fill();
  } else if (kind === "calli") {
    // Asymmetric split-nib calligraphy pen: thicker upper rail + offset lower rail so FLIP visibly alternates
    const specs: Array<[number, number, number]> = [
      [TIP * 0.32, r * 0.88, r * 0.16],
      [TIP * 0.64, r * 0.68, r * 0.09],
    ];
    for (const [cy, rx, ry] of specs) {
      const g = x.createLinearGradient(0, 0, TIP, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.2, "rgba(255,255,255,1)");
      g.addColorStop(0.8, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(r, cy, rx, ry, 0.14, 0, Math.PI * 2);
      x.fill();
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
    // Six uneven teeth in a line perpendicular to stroke travel
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
  } else if (kind === "nib") {
    // Pointed pen nib: solid core with tapered ends
    const g = x.createLinearGradient(0, 0, TIP, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.2, "rgba(255,255,255,1)");
    g.addColorStop(0.8, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(TIP * 0.02, r);
    x.quadraticCurveTo(r, TIP * 0.2, TIP * 0.98, r);
    x.quadraticCurveTo(r, TIP * 0.8, TIP * 0.02, r);
    x.closePath();
    x.fill();
  } else if (kind === "chalk") {
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, TIP, TIP);
    const img = x.getImageData(0, 0, TIP, TIP);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 0.35 + Math.random() * 0.65;
      img.data[i + 3] = Math.round(img.data[i + 3]! * n);
    }
    x.putImageData(img, 0, 0);
  } else if (kind === "spray") {
    for (let i = 0; i < 220 * 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.6) * r * 0.95;
      const s = 1 + Math.random() * 4;
      x.globalAlpha = 0.25 + Math.random() * 0.6;
      x.fillStyle = "#fff";
      x.beginPath();
      x.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, s, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;
  } else {
    // Default fallback
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, TIP, TIP);
  }

  return c;
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
  return EXPRESS_BRUSHES.find((b) => b.id === id) || EXPRESS_BRUSHES[0]!;
}
