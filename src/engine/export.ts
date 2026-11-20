// Snapshot & Video Export for Loopstroke Express

export function exportPng(canvas: HTMLCanvasElement, filename = "loopstroke-art.png") {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function shareCanvas(canvas: HTMLCanvasElement, title = "Loopstroke Artwork") {
  if (navigator.share && canvas.toBlob) {
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (blob) {
        const file = new File([blob], "loopstroke-art.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            text: "Created with Loopstroke Express",
            files: [file],
          });
          return true;
        }
      }
    } catch {
      // Fallback to PNG download
    }
  }
  exportPng(canvas);
  return false;
}

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  public startRecording(canvas: HTMLCanvasElement, fps = 60): boolean {
    if (typeof MediaRecorder === "undefined" || !canvas.captureStream) return false;
    const stream = canvas.captureStream(fps);

    // Pick best supported MIME type across Chrome/Firefox (WebM) & Safari/WKWebView (MP4)
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4;codecs=avc1",
      "video/mp4",
    ];
    const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t));

    try {
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 8_000_000, // 8 Mbps crisp video
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(100);
      return true;
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err);
      return false;
    }
  }

  public stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording"));
        return;
      }

      const rec = this.mediaRecorder;
      rec.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: rec.mimeType || "video/webm",
        });
        this.mediaRecorder = null;
        resolve(blob);
      };

      if (rec.state !== "inactive") {
        rec.stop();
      } else {
        const blob = new Blob(this.recordedChunks, {
          type: rec.mimeType || "video/webm",
        });
        this.mediaRecorder = null;
        resolve(blob);
      }
    });
  }

  public cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      } catch {
        // Ignore
      }
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  public downloadVideo(blob: Blob, baseName = "loopstroke-loop") {
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const filename = baseName.endsWith(".mp4") || baseName.endsWith(".webm") ? baseName : `${baseName}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
