#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const appBundle = path.join(rootDir, "Loopstroke Express.app");
const contentsDir = path.join(appBundle, "Contents");
const macosDir = path.join(contentsDir, "MacOS");
const resourcesDir = path.join(contentsDir, "Resources");

function buildAppIcon(targetIcnsPath) {
  console.log("1. Generating macOS AppIcon.icns...");
  const tmpIconset = path.join(rootDir, ".tmp_AppIcon.iconset");
  fs.rmSync(tmpIconset, { recursive: true, force: true });
  fs.mkdirSync(tmpIconset, { recursive: true });

  const iconGenSwift = path.join(rootDir, ".tmp_gen_icon.swift");
  fs.writeFileSync(
    iconGenSwift,
    `import Cocoa

let outDir = CommandLine.arguments[1]
let sizes: [(String, Int)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

for (name, px) in sizes {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: px,
        pixelsHigh: px,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(px)
    let inset = s * 0.08
    let rect = NSRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let radius = s * 0.22
    let bgPath = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)

    NSColor(calibratedRed: 0.06, green: 0.07, blue: 0.10, alpha: 1.0).setFill()
    bgPath.fill()

    // Express cyan-purple loop ring
    let ringRect = rect.insetBy(dx: s * 0.17, dy: s * 0.17)
    let ring = NSBezierPath(ovalIn: ringRect)
    ring.lineWidth = max(2.0, s * 0.08)
    NSColor(calibratedRed: 0.02, green: 0.71, blue: 0.83, alpha: 1.0).setStroke()
    ring.stroke()

    // Express purple-pink inner accent
    let dotR = s * 0.11
    let dotRect = NSRect(x: s * 0.5 - dotR, y: s * 0.5 - dotR, width: dotR * 2, height: dotR * 2)
    NSColor(calibratedRed: 0.66, green: 0.33, blue: 0.97, alpha: 1.0).setFill()
    NSBezierPath(ovalIn: dotRect).fill()

    NSGraphicsContext.restoreGraphicsState()
    if let png = rep.representation(using: .png, properties: [:]) {
        try? png.write(to: URL(fileURLWithPath: outDir).appendingPathComponent(name))
    }
}
`,
    "utf8",
  );

  execFileSync("swift", [iconGenSwift, tmpIconset], { stdio: "inherit" });
  execFileSync("iconutil", ["-c", "icns", tmpIconset, "-o", targetIcnsPath], { stdio: "inherit" });
  fs.rmSync(tmpIconset, { recursive: true, force: true });
  fs.rmSync(iconGenSwift, { force: true });
}

function writeInfoPlist(plistPath) {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Loopstroke Express</string>
  <key>CFBundleExecutable</key>
  <string>LoopstrokeExpress</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.loopstroke.express</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Loopstroke Express</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>100</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
`;
  fs.writeFileSync(plistPath, plist, "utf8");
}

function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error("dist/ does not exist. Run `npm run build` first.");
  }

  console.log("0. Creating Loopstroke Express.app bundle...");
  fs.rmSync(appBundle, { recursive: true, force: true });
  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });

  writeInfoPlist(path.join(contentsDir, "Info.plist"));
  buildAppIcon(path.join(resourcesDir, "AppIcon.icns"));

  console.log("2. Copying web build dist/ into Contents/Resources/public...");
  fs.cpSync(distDir, path.join(resourcesDir, "public"), { recursive: true });

  console.log("3. Compiling lightweight Swift WKWebView host (arm64)...");
  const swiftSrc = path.join(rootDir, "macos", "LoopstrokeExpressApp.swift");
  const binOut = path.join(macosDir, "LoopstrokeExpress");
  execFileSync(
    "swiftc",
    [
      "-O",
      "-target",
      "arm64-apple-macos13.0",
      "-framework",
      "Cocoa",
      "-framework",
      "WebKit",
      "-framework",
      "Network",
      "-framework",
      "UniformTypeIdentifiers",
      "-framework",
      "AVFoundation",
      swiftSrc,
      "-o",
      binOut,
    ],
    { stdio: "inherit" },
  );

  console.log("4. Ad-hoc signing Loopstroke Express.app...");
  execFileSync("xattr", ["-cr", appBundle], { stdio: "inherit" });
  execFileSync("codesign", ["--force", "--sign", "-", appBundle], { stdio: "inherit" });

  console.log("5. Creating Loopstroke-Express-macOS-AppleSilicon.zip...");
  const zipOut = path.join(rootDir, "Loopstroke-Express-macOS-AppleSilicon.zip");
  fs.rmSync(zipOut, { force: true });
  execFileSync(
    "ditto",
    ["-c", "-k", "--sequesterRsrc", "--keepParent", appBundle, zipOut],
    { stdio: "inherit" },
  );

  console.log("\n✅ Done! Created:");
  console.log("   • " + appBundle);
  console.log("   • " + zipOut);
}

main();
