import Cocoa
@preconcurrency import WebKit
import Network
import UniformTypeIdentifiers
import AVFoundation

// MARK: - Embedded Localhost HTTP Server (127.0.0.1)
// Serves Contents/Resources/public (Vite dist/) over 127.0.0.1 so WKWebView
// runs in a proper W3C Secure Context (WebGL2, localStorage, MediaRecorder, etc.).

final class LocalAssetServer {
    let rootDir: URL
    private var listener: NWListener?
    private(set) var port: UInt16 = 17430
    private let queue = DispatchQueue(label: "com.loopstroke.express.http", qos: .userInteractive, attributes: .concurrent)

    init(rootDir: URL) {
        self.rootDir = rootDir
    }

    func start(ready: @escaping (UInt16) -> Void) {
        tryBind(port: 17430, attemptsLeft: 25, ready: ready)
    }

    private func tryBind(port candidate: UInt16, attemptsLeft: Int, ready: @escaping (UInt16) -> Void) {
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true
        params.requiredLocalEndpoint = NWEndpoint.hostPort(
            host: .ipv4(.loopback),
            port: NWEndpoint.Port(rawValue: candidate)!
        )

        guard let nwListener = try? NWListener(using: params) else {
            if attemptsLeft > 0 {
                tryBind(port: candidate + 1, attemptsLeft: attemptsLeft - 1, ready: ready)
            }
            return
        }

        var didComplete = false
        nwListener.stateUpdateHandler = { [weak self] state in
            guard let self = self, !didComplete else { return }
            switch state {
            case .ready:
                didComplete = true
                self.port = nwListener.port?.rawValue ?? candidate
                DispatchQueue.main.async {
                    ready(self.port)
                }
            case .failed:
                didComplete = true
                nwListener.cancel()
                if attemptsLeft > 0 {
                    self.tryBind(port: candidate + 1, attemptsLeft: attemptsLeft - 1, ready: ready)
                }
            default:
                break
            }
        }

        nwListener.newConnectionHandler = { [weak self] conn in
            self?.handleConnection(conn)
        }

        self.listener = nwListener
        nwListener.start(queue: queue)
    }

    private func handleConnection(_ conn: NWConnection) {
        conn.start(queue: queue)
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, error in
            guard let self = self, error == nil, let data = data, let reqStr = String(data: data, encoding: .utf8) else {
                conn.cancel()
                return
            }
            let firstLine = reqStr.split(separator: "\r\n", maxSplits: 1).first ?? ""
            let parts = firstLine.split(separator: " ")
            let rawPath = parts.count >= 2 ? String(parts[1]) : "/"
            let cleanPath = rawPath.split(separator: "?", maxSplits: 1).first.map(String.init) ?? "/"

            let responseData = self.buildResponse(for: cleanPath)
            conn.send(content: responseData, completion: .contentProcessed { _ in
                conn.cancel()
            })
        }
    }

    private func buildResponse(for rawPath: String) -> Data {
        let decoded = rawPath.removingPercentEncoding ?? rawPath
        var rel = decoded.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if rel.isEmpty {
            rel = "index.html"
        }

        if rel.contains("..") {
            return httpResponse(status: "403 Forbidden", mime: "text/plain", body: Data("Forbidden".utf8))
        }

        var fileURL = rootDir.appendingPathComponent(rel)
        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: fileURL.path, isDirectory: &isDir) {
            if isDir.boolValue {
                fileURL = fileURL.appendingPathComponent("index.html")
            }
        } else {
            let ext = fileURL.pathExtension.lowercased()
            if ext.isEmpty {
                fileURL = rootDir.appendingPathComponent("index.html")
            } else {
                return httpResponse(status: "404 Not Found", mime: "text/plain", body: Data("Not Found".utf8))
            }
        }

        guard let body = try? Data(contentsOf: fileURL) else {
            return httpResponse(status: "404 Not Found", mime: "text/plain", body: Data("Not Found".utf8))
        }

        let mime = Self.mimeType(for: fileURL.pathExtension.lowercased())
        return httpResponse(status: "200 OK", mime: mime, body: body)
    }

    private func httpResponse(status: String, mime: String, body: Data) -> Data {
        var header = "HTTP/1.1 \(status)\r\n"
        header += "Content-Type: \(mime)\r\n"
        header += "Content-Length: \(body.count)\r\n"
        header += "Cache-Control: no-cache\r\n"
        header += "Connection: close\r\n\r\n"
        var out = Data(header.utf8)
        out.append(body)
        return out
    }

    private static func mimeType(for ext: String) -> String {
        switch ext {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "ico": return "image/x-icon"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        default: return "application/octet-stream"
        }
    }
}

// MARK: - AppDelegate (Lightweight WKWebView Host)

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate, WKScriptMessageHandler, NSWindowDelegate {
    private var server: LocalAssetServer?
    private var mainWindow: NSWindow!
    private var mainWebView: WKWebView!
    private var tabletMonitor: Any?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.appearance = NSAppearance(named: .darkAqua)
        setupMenu()

        let resourceURL = Bundle.main.resourceURL?.appendingPathComponent("public")
            ?? URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("dist")

        let srv = LocalAssetServer(rootDir: resourceURL)
        self.server = srv

        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1360, height: 860)
        let winRect = NSRect(
            x: screenRect.origin.x + max(0, (screenRect.width - 1360) / 2),
            y: screenRect.origin.y + max(0, (screenRect.height - 860) / 2),
            width: min(1360, screenRect.width),
            height: min(860, screenRect.height)
        )

        mainWindow = NSWindow(
            contentRect: winRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        mainWindow.title = "Loopstroke Express"
        mainWindow.backgroundColor = NSColor(calibratedRed: 0.04, green: 0.04, blue: 0.05, alpha: 1.0)
        mainWindow.collectionBehavior = [.fullScreenPrimary]
        mainWindow.setFrameAutosaveName("LoopstrokeExpressMainWindow")
        mainWindow.isReleasedWhenClosed = false
        mainWindow.delegate = self

        installTabletMonitor()

        let config = makeWebViewConfiguration()
        mainWebView = WKWebView(frame: mainWindow.contentView!.bounds, configuration: config)
        mainWebView.autoresizingMask = [.width, .height]
        mainWebView.uiDelegate = self
        mainWebView.navigationDelegate = self
        if #available(macOS 13.3, *) {
            mainWebView.isInspectable = true
        }
        mainWindow.contentView?.addSubview(mainWebView)
        mainWindow.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        srv.start { [weak self] port in
            guard let self = self else { return }
            if let url = URL(string: "http://127.0.0.1:\(port)/") {
                self.mainWebView.load(URLRequest(url: url))
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            mainWindow.makeKeyAndOrderFront(nil)
        }
        return true
    }

    // MARK: - Tablet / Stylus Pressure & Tilt Monitor (Wacom, Huion, Sidecar Apple Pencil)

    private func installTabletMonitor() {
        var tabletActive = false
        var lastTabletJsTime: TimeInterval = 0
        tabletMonitor = NSEvent.addLocalMonitorForEvents(
            matching: [.leftMouseDown, .leftMouseDragged, .leftMouseUp, .tabletPoint, .tabletProximity]
        ) { [weak self] event in
            guard let self = self, let webView = self.mainWebView else { return event }
            let now = event.timestamp
            switch event.type {
            case .tabletProximity:
                if !event.isEnteringProximity && tabletActive {
                    tabletActive = false
                    webView.evaluateJavaScript("if (window.__LOOPSTROKE_TABLET__) window.__LOOPSTROKE_TABLET__.active = false;", completionHandler: nil)
                }
            case .tabletPoint:
                tabletActive = true
                if now - lastTabletJsTime >= 0.012 {
                    lastTabletJsTime = now
                    let press = Double(event.pressure)
                    let tx = Double(event.tilt.x * 90.0)
                    let ty = Double(event.tilt.y * 90.0)
                    let rot = Double(event.rotation)
                    let js = "window.__LOOPSTROKE_TABLET__ = { pressure: \(press), tiltX: \(tx), tiltY: \(ty), rotation: \(rot), active: true, time: \(Date().timeIntervalSince1970) };"
                    webView.evaluateJavaScript(js, completionHandler: nil)
                }
            case .leftMouseDown, .leftMouseDragged:
                let isTabletSubtype = event.subtype == .tabletPoint
                let rawPress = event.pressure
                let hasForcePressure = !isTabletSubtype && rawPress > 0 && rawPress != 0.5 && rawPress != 1.0
                if isTabletSubtype || hasForcePressure {
                    tabletActive = true
                    if event.type == .leftMouseDown || (now - lastTabletJsTime >= 0.012) {
                        lastTabletJsTime = now
                        let press = Double(rawPress)
                        let tx = isTabletSubtype ? Double(event.tilt.x * 90.0) : 0.0
                        let ty = isTabletSubtype ? Double(event.tilt.y * 90.0) : 0.0
                        let rot = isTabletSubtype ? Double(event.rotation) : 0.0
                        let js = "window.__LOOPSTROKE_TABLET__ = { pressure: \(press), tiltX: \(tx), tiltY: \(ty), rotation: \(rot), active: true, time: \(Date().timeIntervalSince1970) };"
                        webView.evaluateJavaScript(js, completionHandler: nil)
                    }
                }
            case .leftMouseUp:
                if tabletActive {
                    tabletActive = false
                    webView.evaluateJavaScript("if (window.__LOOPSTROKE_TABLET__) window.__LOOPSTROKE_TABLET__.active = false;", completionHandler: nil)
                }
            default:
                break
            }
            return event
        }
    }

    private func makeWebViewConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.mediaTypesRequiringUserActionForPlayback = []
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        let ucc = WKUserContentController()
        ucc.add(self, name: "loopstrokeSave")

        // Intercept <a download="..."> clicks for data: and blob: URLs so PNG/MP4 exports open a native NSSavePanel
        let bridgeJS = """
        (function() {
          const blobMap = new Map();
          const origCreate = URL.createObjectURL.bind(URL);
          const origRevoke = URL.revokeObjectURL.bind(URL);
          URL.createObjectURL = function(obj) {
            const url = origCreate(obj);
            if (obj instanceof Blob) blobMap.set(url, obj);
            return url;
          };
          URL.revokeObjectURL = function(url) {
            setTimeout(() => {
              blobMap.delete(url);
              origRevoke(url);
            }, 4000);
          };
          const origClick = HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click = function() {
            const dl = this.getAttribute('download') || this.download;
            const href = this.href || '';
            if (dl && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.loopstrokeSave) {
              if (href.startsWith('data:')) {
                window.webkit.messageHandlers.loopstrokeSave.postMessage({ filename: dl, dataUrl: href });
                return;
              }
              const b = blobMap.get(href);
              if (b) {
                blobMap.delete(href);
                const reader = new FileReader();
                reader.onloadend = function() {
                  if (typeof reader.result === 'string') {
                    window.webkit.messageHandlers.loopstrokeSave.postMessage({ filename: dl, dataUrl: reader.result });
                  }
                };
                reader.readAsDataURL(b);
                return;
              }
            }
            return origClick.apply(this, arguments);
          };
        })();
        """
        ucc.addUserScript(WKUserScript(source: bridgeJS, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        config.userContentController = ucc
        return config
    }

    // MARK: - Menu Bar

    private func setupMenu() {
        let mainMenu = NSMenu()
        NSApp.mainMenu = mainMenu

        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "About Loopstroke Express", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide Loopstroke Express", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Loopstroke Express", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let fileMenuItem = NSMenuItem()
        mainMenu.addItem(fileMenuItem)
        let fileMenu = NSMenu(title: "File")
        fileMenuItem.submenu = fileMenu
        let exportImg = fileMenu.addItem(withTitle: "Export Image (PNG)", action: #selector(exportImageAction), keyEquivalent: "s")
        exportImg.keyEquivalentModifierMask = [.command]
        let exportWin = fileMenu.addItem(withTitle: "Export & Record Video...", action: #selector(openExportAction), keyEquivalent: "e")
        exportWin.keyEquivalentModifierMask = [.command, .shift]
        fileMenu.addItem(NSMenuItem.separator())
        fileMenu.addItem(withTitle: "Reload Sketchbook", action: #selector(reloadApp), keyEquivalent: "r")
        let closeItem = fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        closeItem.keyEquivalentModifierMask = [.command]

        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        let undoItem = editMenu.addItem(withTitle: "Undo", action: #selector(appUndo), keyEquivalent: "z")
        undoItem.keyEquivalentModifierMask = [.command]
        let redoItem = editMenu.addItem(withTitle: "Redo", action: #selector(appRedo), keyEquivalent: "Z")
        redoItem.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenu.addItem(NSMenuItem.separator())
        let clearItem = editMenu.addItem(withTitle: "Clear Canvas", action: #selector(clearCanvasAction), keyEquivalent: "X")
        clearItem.keyEquivalentModifierMask = [.command, .shift]

        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        let fsItem = viewMenu.addItem(withTitle: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fsItem.keyEquivalentModifierMask = [.command, .control]

        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        NSApp.windowsMenu = windowMenu
    }

    @objc private func reloadApp() {
        mainWebView?.reload()
    }

    @objc private func appUndo() {
        mainWebView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('loopstroke:undo'));", completionHandler: nil)
    }

    @objc private func appRedo() {
        mainWebView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('loopstroke:redo'));", completionHandler: nil)
    }

    @objc private func clearCanvasAction() {
        mainWebView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('loopstroke:clear'));", completionHandler: nil)
    }

    @objc private func exportImageAction() {
        mainWebView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('loopstroke:export-png'));", completionHandler: nil)
    }

    @objc private func openExportAction() {
        mainWebView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('loopstroke:open-export'));", completionHandler: nil)
    }

    // MARK: - WKUIDelegate & WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        panel.beginSheetModal(for: webView.window ?? mainWindow) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        preferences: WKWebpagePreferences,
        decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void
    ) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download, preferences)
            return
        }
        decisionHandler(.allow, preferences)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        if !navigationResponse.canShowMIMEType {
            decisionHandler(.download)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = suggestedFilename
        savePanel.canCreateDirectories = true
        if let downloadsDir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first {
            savePanel.directoryURL = downloadsDir
        }
        savePanel.beginSheetModal(for: mainWindow) { result in
            if result == .OK, let targetURL = savePanel.url {
                try? FileManager.default.removeItem(at: targetURL)
                completionHandler(targetURL)
            } else {
                completionHandler(nil)
            }
        }
    }

    // MARK: - Blob / Data URL Save Handler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "loopstrokeSave",
              let dict = message.body as? [String: Any],
              let filename = dict["filename"] as? String,
              let dataUrl = dict["dataUrl"] as? String,
              let commaIdx = dataUrl.firstIndex(of: ",") else {
            return
        }
        let b64 = String(dataUrl[dataUrl.index(after: commaIdx)...])
        guard let fileData = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else { return }

        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = filename
        savePanel.canCreateDirectories = true
        if let downloadsDir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first {
            savePanel.directoryURL = downloadsDir
        }
        savePanel.beginSheetModal(for: mainWindow) { result in
            if result == .OK, let targetURL = savePanel.url {
                self.writeExportedFile(data: fileData, suggestedFilename: filename, to: targetURL)
            }
        }
    }

    private func writeExportedFile(data: Data, suggestedFilename: String, to targetURL: URL) {
        let srcExt = URL(fileURLWithPath: suggestedFilename).pathExtension.lowercased()
        let dstExt = targetURL.pathExtension.lowercased()
        let isVideo = srcExt == "mp4" || srcExt == "mov" || srcExt == "webm" || dstExt == "mp4" || dstExt == "mov"
        guard isVideo else {
            try? data.write(to: targetURL, options: .atomic)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let tmpIn = FileManager.default.temporaryDirectory
                .appendingPathComponent("loopstroke_express_in_\(UUID().uuidString).\(srcExt.isEmpty ? "mp4" : srcExt)")
            defer { try? FileManager.default.removeItem(at: tmpIn) }

            do {
                try data.write(to: tmpIn, options: .atomic)
            } catch {
                return
            }

            let asset = AVURLAsset(url: tmpIn)
            let wantMov = dstExt == "mov"
            var hasFragments = false
            let fragSem = DispatchSemaphore(value: 0)
            Task {
                hasFragments = (try? await asset.load(.containsFragments)) ?? false
                fragSem.signal()
            }
            fragSem.wait()
            let needsRemux = hasFragments || srcExt == "webm" || (wantMov && srcExt != "mov")

            if !needsRemux {
                try? FileManager.default.removeItem(at: targetURL)
                do {
                    try FileManager.default.moveItem(at: tmpIn, to: targetURL)
                } catch {
                    try? data.write(to: targetURL, options: .atomic)
                }
                return
            }

            let preset = srcExt == "webm" ? AVAssetExportPresetHighestQuality : AVAssetExportPresetPassthrough
            guard let session = AVAssetExportSession(asset: asset, presetName: preset) else {
                try? data.write(to: targetURL, options: .atomic)
                return
            }
            let tmpOut = FileManager.default.temporaryDirectory
                .appendingPathComponent("loopstroke_express_out_\(UUID().uuidString).\(wantMov ? "mov" : "mp4")")
            try? FileManager.default.removeItem(at: tmpOut)
            session.outputURL = tmpOut
            session.outputFileType = wantMov ? .mov : .mp4
            session.shouldOptimizeForNetworkUse = true

            let sem = DispatchSemaphore(value: 0)
            session.exportAsynchronously { sem.signal() }
            sem.wait()

            if session.status == .completed, FileManager.default.fileExists(atPath: tmpOut.path) {
                try? FileManager.default.removeItem(at: targetURL)
                try? FileManager.default.moveItem(at: tmpOut, to: targetURL)
            } else {
                try? FileManager.default.removeItem(at: tmpOut)
                try? data.write(to: targetURL, options: .atomic)
            }
        }
    }
}

// MARK: - Main Entrypoint

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
