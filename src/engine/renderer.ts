// WebGL2 hardware-accelerated renderer for Loopstroke Express
import { tipMask } from "./brushes";

export type ExpressBlendMode = "normal" | "add" | "difference" | "multiply";

const STAMP_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_quad; // -0.5..0.5
layout(location = 1) in vec2 a_uv;   // 0..1

// Instance attributes
layout(location = 2) in vec4 a_posSize; // cx, cy, w, h
layout(location = 3) in vec4 a_rotFlip; // angleRad, flipX (-1 or 1), flipY (-1 or 1), unused
layout(location = 4) in vec4 a_color;   // r, g, b, alpha

uniform vec2 u_res;

out vec2 v_uv;
out vec4 v_color;

void main() {
  vec2 local = a_quad * a_posSize.zw * a_rotFlip.yz;
  float cs = cos(a_rotFlip.x);
  float sn = sin(a_rotFlip.x);
  vec2 rotated = vec2(
    local.x * cs - local.y * sn,
    local.x * sn + local.y * cs
  );
  vec2 world = a_posSize.xy + rotated;
  
  // Convert world pixels to NDC (-1..1) with Y pointing down
  vec2 ndc = vec2((world.x / u_res.x) * 2.0 - 1.0, 1.0 - (world.y / u_res.y) * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_uv = a_uv;
  v_color = a_color;
}
`;

const STAMP_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec4 v_color;

uniform sampler2D u_tip;

out vec4 fragColor;

void main() {
  vec4 tex = texture(u_tip, v_uv);
  float a = tex.a * v_color.a;
  if (a < 0.002) discard;
  // Pre-multiplied alpha
  fragColor = vec4(v_color.rgb * a, a);
}
`;

const COMP_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_pos; // -1..1
layout(location = 1) in vec2 a_uv;  // 0..1

out vec2 v_uv;

void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  v_uv = a_uv;
}
`;

const COMP_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_layer;
uniform sampler2D u_dst;
uniform float u_opacity;
uniform int u_blendMode; // -1=copy, 0=normal, 1=add, 2=difference, 3=multiply

out vec4 fragColor;

void main() {
  vec4 src = texture(u_layer, v_uv) * u_opacity;
  if (u_blendMode < 0) {
    fragColor = src;
    return;
  }
  vec4 dst = texture(u_dst, v_uv);
  vec3 outRgb;
  if (u_blendMode == 1) {
    // Add (Glow)
    outRgb = min(vec3(1.0), dst.rgb + src.rgb);
  } else if (u_blendMode == 2) {
    // Difference (premultiplied alpha over opaque dst)
    outRgb = dst.rgb * (1.0 - src.a) + abs(dst.rgb * src.a - src.rgb);
  } else if (u_blendMode == 3) {
    // Multiply (premultiplied alpha)
    outRgb = dst.rgb * (1.0 - src.a) + dst.rgb * src.rgb;
  } else {
    // Normal (premultiplied source-over)
    outRgb = src.rgb + dst.rgb * (1.0 - src.a);
  }
  fragColor = vec4(outRgb, 1.0);
}
`;

const DECAY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_layer;
uniform float u_factor; // 0..1 multiplier

out vec4 fragColor;

void main() {
  vec4 c = texture(u_layer, v_uv);
  fragColor = c * u_factor;
}
`;

interface LayerFBO {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export class ExpressGLRenderer {
  public gl: WebGL2RenderingContext;
  private stampProg!: WebGLProgram;
  private compProg!: WebGLProgram;
  private decayProg!: WebGLProgram;

  private quadVbo!: WebGLBuffer;
  private quadVao!: WebGLVertexArrayObject;
  private compVao!: WebGLVertexArrayObject;

  // Stamp batch buffer
  private readonly MAX_STAMPS = 2048;
  private readonly FLOATS_PER_STAMP = 12; // 4 posSize + 4 rotFlip + 4 color
  private stampData: Float32Array;
  private stampVbo!: WebGLBuffer;
  private queuedStamps = 0;
  private currentTip = "";

  // Tip textures
  private tipTextures = new Map<string, WebGLTexture>();

  // Layer FBOs
  private layerFBOs = new Map<number, LayerFBO>();
  private tempFBO?: LayerFBO;
  private compFBO?: LayerFBO;
  private compAltFBO?: LayerFBO;

  public width = 1;
  public height = 1;
  public dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!gl) {
      throw new Error("WebGL2 is not supported on this device.");
    }
    this.gl = gl;
    this.stampData = new Float32Array(this.MAX_STAMPS * this.FLOATS_PER_STAMP);
    this.initShaders();
    this.initBuffers();
  }

  private createShader(type: number, src: string): WebGLShader {
    const s = this.gl.createShader(type)!;
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      const err = this.gl.getShaderInfoLog(s);
      this.gl.deleteShader(s);
      throw new Error(`Shader compile error: ${err}`);
    }
    return s;
  }

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const vs = this.createShader(this.gl.VERTEX_SHADER, vertSrc);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, fragSrc);
    const p = this.gl.createProgram()!;
    this.gl.attachShader(p, vs);
    this.gl.attachShader(p, fs);
    this.gl.linkProgram(p);
    if (!this.gl.getProgramParameter(p, this.gl.LINK_STATUS)) {
      const err = this.gl.getProgramInfoLog(p);
      this.gl.deleteProgram(p);
      throw new Error(`Program link error: ${err}`);
    }
    return p;
  }

  private initShaders() {
    this.stampProg = this.createProgram(STAMP_VERT, STAMP_FRAG);
    this.compProg = this.createProgram(COMP_VERT, COMP_FRAG);
    this.decayProg = this.createProgram(COMP_VERT, DECAY_FRAG);
  }

  private initBuffers() {
    const gl = this.gl;

    // Unit quad (-0.5..0.5) with UV (0..1)
    const quadVerts = new Float32Array([
      // pos.x, pos.y, uv.u, uv.v
      -0.5, -0.5, 0.0, 0.0,
       0.5, -0.5, 1.0, 0.0,
      -0.5,  0.5, 0.0, 1.0,
      -0.5,  0.5, 0.0, 1.0,
       0.5, -0.5, 1.0, 0.0,
       0.5,  0.5, 1.0, 1.0,
    ]);

    this.quadVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    // Stamp VAO
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.enableVertexAttribArray(0); // a_quad
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1); // a_uv
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    // Dynamic instance buffer
    this.stampVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stampVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.stampData.byteLength, gl.DYNAMIC_DRAW);

    const stride = this.FLOATS_PER_STAMP * 4;
    gl.enableVertexAttribArray(2); // a_posSize
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(2, 1);

    gl.enableVertexAttribArray(3); // a_rotFlip
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(3, 1);

    gl.enableVertexAttribArray(4); // a_color
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, stride, 32);
    gl.vertexAttribDivisor(4, 1);

    gl.bindVertexArray(null);

    // Fullscreen quad for compositing (-1..1)
    const compVerts = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
      -1,  1, 0, 1,
       1, -1, 1, 0,
       1,  1, 1, 1,
    ]);
    const compVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, compVbo);
    gl.bufferData(gl.ARRAY_BUFFER, compVerts, gl.STATIC_DRAW);

    this.compVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.compVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
  }

  public resize(cssWidth: number, cssHeight: number, dpr: number) {
    this.dpr = Math.min(dpr || 1, 2.5);
    const pixelW = Math.max(1, Math.round(cssWidth * this.dpr));
    const pixelH = Math.max(1, Math.round(cssHeight * this.dpr));

    if (this.width === pixelW && this.height === pixelH) return;

    this.width = pixelW;
    this.height = pixelH;
    this.gl.canvas.width = pixelW;
    this.gl.canvas.height = pixelH;

    // Recreate layer FBOs for new dimensions
    this.destroyFBOs();
  }

  private createFBO(w: number, h: number): LayerFBO {
    const gl = this.gl;
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }

  public getLayerFBO(layerId: number): LayerFBO {
    let fbo = this.layerFBOs.get(layerId);
    if (!fbo || fbo.w !== this.width || fbo.h !== this.height) {
      if (fbo) {
        this.gl.deleteFramebuffer(fbo.fb);
        this.gl.deleteTexture(fbo.tex);
      }
      fbo = this.createFBO(this.width, this.height);
      this.layerFBOs.set(layerId, fbo);
    }
    return fbo;
  }

  private destroyFBOs() {
    for (const fbo of this.layerFBOs.values()) {
      this.gl.deleteFramebuffer(fbo.fb);
      this.gl.deleteTexture(fbo.tex);
    }
    this.layerFBOs.clear();
    if (this.tempFBO) {
      this.gl.deleteFramebuffer(this.tempFBO.fb);
      this.gl.deleteTexture(this.tempFBO.tex);
      this.tempFBO = undefined;
    }
    if (this.compFBO) {
      this.gl.deleteFramebuffer(this.compFBO.fb);
      this.gl.deleteTexture(this.compFBO.tex);
      this.compFBO = undefined;
    }
    if (this.compAltFBO) {
      this.gl.deleteFramebuffer(this.compAltFBO.fb);
      this.gl.deleteTexture(this.compAltFBO.tex);
      this.compAltFBO = undefined;
    }
  }

  private ensureTargetFBO(existing: LayerFBO | undefined): LayerFBO {
    if (existing && existing.w === this.width && existing.h === this.height) {
      return existing;
    }
    if (existing) {
      this.gl.deleteFramebuffer(existing.fb);
      this.gl.deleteTexture(existing.tex);
    }
    return this.createFBO(this.width, this.height);
  }

  public invalidateTipTexture(tipId: string) {
    const tex = this.tipTextures.get(tipId);
    if (tex) {
      this.gl.deleteTexture(tex);
      this.tipTextures.delete(tipId);
    }
  }

  public clearLayer(layerId: number) {
    const fbo = this.getLayerFBO(layerId);
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  public clearAllLayers() {
    for (const fbo of this.layerFBOs.values()) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb);
      gl.viewport(0, 0, this.width, this.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  public getTipTexture(tipId: string): WebGLTexture {
    let tex = this.tipTextures.get(tipId);
    if (!tex) {
      const gl = this.gl;
      tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const maskCanvas = tipMask(tipId);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        maskCanvas,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tipTextures.set(tipId, tex);
    }
    return tex;
  }

  public beginStampBatch(tipId: string) {
    if (this.currentTip !== tipId && this.queuedStamps > 0) {
      this.flushStamps();
    }
    this.currentTip = tipId;
  }

  public addStamp(
    cx: number,
    cy: number,
    w: number,
    h: number,
    angle: number,
    flipX: number,
    flipY: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ) {
    if (this.queuedStamps >= this.MAX_STAMPS) {
      this.flushStamps();
    }

    const idx = this.queuedStamps * this.FLOATS_PER_STAMP;
    const d = this.stampData;
    // Scale coordinates by dpr for high-res crisp rendering
    d[idx + 0] = cx * this.dpr;
    d[idx + 1] = cy * this.dpr;
    d[idx + 2] = w * this.dpr;
    d[idx + 3] = h * this.dpr;

    d[idx + 4] = angle;
    d[idx + 5] = flipX;
    d[idx + 6] = flipY;
    d[idx + 7] = 0;

    d[idx + 8] = r;
    d[idx + 9] = g;
    d[idx + 10] = b;
    d[idx + 11] = a;

    this.queuedStamps++;
  }

  public flushStamps(targetFbo?: WebGLFramebuffer | null) {
    if (this.queuedStamps === 0) return;

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo ?? null);
    gl.viewport(0, 0, this.width, this.height);

    gl.useProgram(this.stampProg);
    gl.bindVertexArray(this.quadVao);

    // Bind texture
    const tex = this.getTipTexture(this.currentTip);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(this.stampProg, "u_tip"), 0);
    gl.uniform2f(gl.getUniformLocation(this.stampProg, "u_res"), this.width, this.height);

    // Update instance VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stampVbo);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.stampData.subarray(0, this.queuedStamps * this.FLOATS_PER_STAMP),
    );

    // Blending: Pre-multiplied alpha source-over
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.queuedStamps);

    this.queuedStamps = 0;
  }

  public decayLayer(layerId: number, factor: number) {
    if (factor >= 0.999) return;
    const fbo = this.getLayerFBO(layerId);
    if (!this.tempFBO || this.tempFBO.w !== this.width || this.tempFBO.h !== this.height) {
      if (this.tempFBO) {
        this.gl.deleteFramebuffer(this.tempFBO.fb);
        this.gl.deleteTexture(this.tempFBO.tex);
      }
      this.tempFBO = this.createFBO(this.width, this.height);
    }

    const gl = this.gl;
    // Render fbo into tempFBO multiplied by factor
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempFBO.fb);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.decayProg);
    gl.bindVertexArray(this.compVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.tex);
    gl.uniform1i(gl.getUniformLocation(this.decayProg, "u_layer"), 0);
    gl.uniform1f(gl.getUniformLocation(this.decayProg, "u_factor"), factor);

    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap tex
    const tmpTex = fbo.tex;
    fbo.tex = this.tempFBO.tex;
    this.tempFBO.tex = tmpTex;

    // Reattach texture to original FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      fbo.tex,
      0,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  public renderComposition(
    layers: Array<{ id: number; opacity: number; blend: ExpressBlendMode; visible: boolean }>,
  ) {
    const gl = this.gl;
    let dstFBO: LayerFBO = this.ensureTargetFBO(this.compFBO);
    let altFBO: LayerFBO = this.ensureTargetFBO(this.compAltFBO);
    this.compFBO = dstFBO;
    this.compAltFBO = altFBO;

    // Clear accumulation FBO with deep dark stage background
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fb);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0.04, 0.04, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.compProg);
    gl.bindVertexArray(this.compVao);
    gl.disable(gl.BLEND);

    const uLayerLoc = gl.getUniformLocation(this.compProg, "u_layer");
    const uDstLoc = gl.getUniformLocation(this.compProg, "u_dst");
    const uOpacityLoc = gl.getUniformLocation(this.compProg, "u_opacity");
    const uBlendLoc = gl.getUniformLocation(this.compProg, "u_blendMode");

    for (const l of layers) {
      if (!l.visible || l.opacity <= 0.001) continue;
      const fbo = this.getLayerFBO(l.id);

      gl.bindFramebuffer(gl.FRAMEBUFFER, altFBO.fb);
      gl.viewport(0, 0, this.width, this.height);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbo.tex);
      gl.uniform1i(uLayerLoc, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, dstFBO.tex);
      gl.uniform1i(uDstLoc, 1);

      gl.uniform1f(uOpacityLoc, l.opacity);
      const modeInt =
        l.blend === "add" ? 1 : l.blend === "difference" ? 2 : l.blend === "multiply" ? 3 : 0;
      gl.uniform1i(uBlendLoc, modeInt);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Ping-pong swap
      const tmp = dstFBO;
      dstFBO = altFBO;
      altFBO = tmp;
    }

    this.compFBO = dstFBO;
    this.compAltFBO = altFBO;

    // Present final composited frame to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dstFBO.tex);
    gl.uniform1i(uLayerLoc, 0);
    gl.uniform1f(uOpacityLoc, 1.0);
    gl.uniform1i(uBlendLoc, -1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindVertexArray(null);
  }
}
