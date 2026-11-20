# Loopstroke Express ⚡️

**Loopstroke Express** is a fast, spontaneous, live-drawn looping animation sketchbook. It is designed for tablets with styluses (Apple Pencil on iPad, Samsung S-Pen on Android), macOS desktop (`WKWebView` app), and modern browsers on Mac, Windows, and Linux.

> **Status:** Early public release / active development. Core looping, brushes, layers, and exports work, with ongoing polish and fixes in progress.

---

## Key Highlights

- **WebGL2 Hardware Acceleration**: Smooth 60–120 FPS instanced rendering with minimal overhead.
- **Stylus & Touch Ready**:
  - W3C Pointer Events (`pressure`, `tiltX`, `tiltY`) with `getCoalescedEvents()` for high-rate pen tracking.
  - Native macOS tablet bridge (`NSEvent` tablet pressure & tilt) inside the standalone macOS app.
  - Multi-touch gestures: **Two-finger tap to Undo**, **Three-finger tap to Redo**.
  - Trackpad two-finger scroll/pinch brush sizing + live brush shape & size preview.
- **10 Curated Brushes + Custom PNG Import**:
  - **Solid Round** (`hard`), **Soft Round** (`soft`), **Wet Waterbrush** (`water`), **Chisel Nib** (`calli`), **Chalk Grain** (`chalk`), **Spray Paint** (`spray`), **Foliage Leaf** (`leaf`), **Rake Comb** (`rake`), **Ink Splat** (`splat`), and **Neon Glow** (`glow`).
  - Import up to **8 custom PNG brush tips** (saved locally) and dial Size up to `400px`, Opacity, Spacing, Jitter, and Flip.
- **Color Palette & Randomizer**:
  - Distinct high-contrast color swatches, custom picker, instant **Random Color** button, and **Auto** random-color-per-stroke mode.
- **4 Drawing Layers**:
  - Blend modes: `Normal`, `Add (Glow)`, `Difference`, `Multiply`.
  - Per-layer opacity, visibility toggle, playback mode, stroke cap (`80` strokes/layer), and undoable clear.
- **Looping & Trails**:
  - **LOOP**, **PING-PONG**, and **HOLD** playback modes.
  - Readable cycle durations (`1s`, `2s`, `4s`, `8s`) plus **BPM** input & **Tap Tempo**.
  - **TRAIL** decay (`FULL` persistence or `0.25s`–`4.0s` fading tail).
- **Non-Blocking Floating UI**:
  - Draggable, minimizable `FloatBox` panels with viewport clamping and `localStorage` position memory.
- **Zero Stage/Pro Bloat**:
  - No DMX/Art-Net, OSC, MIDI Learn, Syphon, NDI, or WebSocket relay dependencies.
- **Export Everywhere**:
  - High-res PNG snapshots.
  - Real-time 60 FPS video loop recording (`1x` or `2x` cycles in WebM or MP4).
  - Mobile Share Sheet (`navigator.share`) and native macOS Save dialog.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start local development server (Browser / PC / Tablet)
npm run dev

# Build static Web / PC / PWA bundle into dist/
npm run build

# Preview production build locally
npm run preview

# Build standalone macOS Apple Silicon app (Loopstroke Express.app)
npm run build:app
```

---

## Target Platforms

### 1. Web & PWA (Mac, Windows, Linux, iPad, Android)
The production build in `dist/` is 100% static client-side HTML/JS/CSS:
- Deploy to **Cloudflare Pages**, **Vercel**, **Netlify**, or **GitHub Pages**.
- **PWA on iPad / Android**: Open in Safari (iPad) or Chrome (Android) and tap **Share > Add to Home Screen** for full-screen drawing with Apple Pencil / S-Pen pressure and tilt.

### 2. Standalone macOS App (Apple Silicon)
`macos/LoopstrokeExpressApp.swift` wraps `dist/` in a lightweight native Swift + `WKWebView` host (`Cocoa`, `WebKit`, `Network`, `UniformTypeIdentifiers`, `AVFoundation` — no third-party native frameworks):
- Run `npm run build:app` on macOS to generate `Loopstroke Express.app` and `Loopstroke-Express-macOS-AppleSilicon.zip`.
- *(Note: The compiled `.app` is ad-hoc signed locally; on other Macs you can distribute via GitHub Releases or run `npm run build:app` from source.)*

### 3. Native iOS / Android via Capacitor (Planned / Optional)
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Loopstroke Express" "com.loopstroke.express" --web-dir dist
npm install @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
npm run build && npx cap sync
```

---

## Keyboard & Touch Shortcuts

- `Space`: Play / Pause loop playback
- `Cmd + Z` / `Ctrl + Z`: Undo *(or two-finger tap)*
- `Cmd + Shift + Z` / `Ctrl + Y`: Redo *(or three-finger tap)*
- `1`–`4`: Select Layer 1–4
- `[` / `]`: Decrease / increase brush size
- `Cmd + S` *(macOS app)*: Export PNG
- `Cmd + Shift + E` *(macOS app)*: Open Export & Video Recorder

---

## Roadmap / Known WIP
- Pinch-to-zoom & two-finger canvas pan on touchscreens.
- Additional brush & mobile UI refinements.
