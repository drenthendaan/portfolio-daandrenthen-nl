// WebGL2-renderer voor de Thailand-filter. Het voorbeeld tekent hij op het
// scherm; bij bewaren rendert hij de volle foto in tegels van 2048² en leest die
// terug. De kleur komt uit een 3D-LUT (look.mjs, gebakken in een worker), grain
// en gloed komen uit de shaders.
//
// Halation en bloom worden één keer per foto berekend, op het verkleinde
// voorbeeld. Ze zijn zacht genoeg om daarna op elke resolutie te gebruiken, dus
// voorbeeld en export krijgen precies dezelfde gloed.

import { SAMENSTELLEN, VERKLEINEN, VERTEX, VERVAGEN, VOORBEREIDEN } from "./shaders.js";

export const TEGEL = 2048;
const GLOED_ZIJDE = 1024;
const BLOOM_ZIJDE = 256;
const VIGNET = 0.15;
// Korrelgrootte: de korte zijde van de foto telt zoveel korrels. Zo heeft een
// foto van 12 of 48 MP hetzelfde grain, net als film van hetzelfde formaat.
const KORRELS_OP_KORTE_ZIJDE = 1800;

const pauze = () => new Promise((klaar) => setTimeout(klaar, 0));

function compileer(gl, soort, bron) {
  const shader = gl.createShader(soort);
  gl.shaderSource(shader, bron);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compileert niet: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function maakProgramma(gl, fragment) {
  const p = gl.createProgram();
  gl.attachShader(p, compileer(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(p, compileer(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(p, 0, "hoek");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Programma linkt niet: ${gl.getProgramInfoLog(p)}`);
  }
  const uniformen = {};
  const aantal = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < aantal; i++) {
    const info = gl.getActiveUniform(p, i);
    uniformen[info.name] = { plek: gl.getUniformLocation(p, info.name), type: info.type };
  }
  return { p, uniformen };
}

export class Renderer {
  constructor(canvas, { opVerlies } = {}) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("Deze browser ondersteunt geen WebGL2.");
    this.gl = gl;
    this.canvas = canvas;
    // Zonder deze extensie kunnen de gloedbuffers alleen 8-bit; dat werkt ook
    this.floatDoel = Boolean(gl.getExtension("EXT_color_buffer_float"));
    this.maxTextuur = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    this.prog = {
      voorbereiden: maakProgramma(gl, VOORBEREIDEN),
      verkleinen: maakProgramma(gl, VERKLEINEN),
      vervagen: maakProgramma(gl, VERVAGEN),
      samenstellen: maakProgramma(gl, SAMENSTELLEN),
    };

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.fbo = gl.createFramebuffer();
    this.lut = null;
    this.lutN = 0;

    this.verloren = false;
    this.bijVerlies = (e) => {
      e.preventDefault();
      this.verloren = true;
      opVerlies?.();
    };
    canvas.addEventListener("webglcontextlost", this.bijVerlies);
  }

  maakTextuur(b, h, { float = false, mips = false, data = null } = {}) {
    const { gl } = this;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const niveaus = mips ? Math.floor(Math.log2(Math.max(b, h))) + 1 : 1;
    gl.texStorage2D(gl.TEXTURE_2D, niveaus, float && this.floatDoel ? gl.RGBA16F : gl.RGBA8, b, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (data) {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, b, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    }
    return { tex, b, h };
  }

  verwijder(textuur) {
    if (textuur) this.gl.deleteTexture(textuur.tex);
  }

  zetUniformen(prog, waarden) {
    const { gl } = this;
    let eenheid = 0;
    for (const [naam, waarde] of Object.entries(waarden)) {
      const u = prog.uniformen[naam];
      if (!u) continue; // niet gebruikt in deze shader
      switch (u.type) {
        case gl.FLOAT:
          gl.uniform1f(u.plek, waarde);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2f(u.plek, waarde[0], waarde[1]);
          break;
        case gl.INT:
          gl.uniform1i(u.plek, waarde);
          break;
        case gl.BOOL:
          gl.uniform1i(u.plek, waarde ? 1 : 0);
          break;
        case gl.SAMPLER_2D:
        case gl.SAMPLER_3D:
          gl.activeTexture(gl.TEXTURE0 + eenheid);
          gl.bindTexture(u.type === gl.SAMPLER_3D ? gl.TEXTURE_3D : gl.TEXTURE_2D, waarde);
          gl.uniform1i(u.plek, eenheid++);
          break;
        default:
          throw new Error(`Onbekend uniformtype voor ${naam}`);
      }
    }
  }

  // Tekent een programma naar een textuur (doel) of, zonder doel, naar het scherm
  teken(prog, doel, waarden, viewport = null) {
    const { gl } = this;
    gl.useProgram(prog.p);
    if (doel) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, doel.tex, 0);
      gl.viewport(0, 0, viewport?.[0] ?? doel.b, viewport?.[1] ?? doel.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    this.zetUniformen(prog, waarden);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // LUT uit look.mjs: N³ RGB-waarden, rood loopt het snelst
  zetLut(data, N) {
    const { gl } = this;
    if (!this.lut) this.lut = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.lut);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, N, N, N, 0, gl.RGB, gl.FLOAT, data);
    this.lutN = N;
  }

  vervaag(van, naar, richting, sigma, drempel) {
    this.teken(this.prog.vervagen, naar, {
      invoer: van.tex,
      doelGrootte: [naar.b, naar.h],
      richting,
      sigma,
      straal: Math.min(64, Math.ceil(sigma * 3)),
      drempel,
    });
  }

  maakGloed(bron, p3) {
    const schaal = Math.min(1, GLOED_ZIJDE / Math.max(bron.b, bron.h));
    const b = Math.max(1, Math.round(bron.b * schaal));
    const h = Math.max(1, Math.round(bron.h * schaal));
    const lin = this.maakTextuur(b, h, { float: true });
    this.teken(this.prog.voorbereiden, lin, { bron: bron.tex, doelGrootte: [b, h], p3 });

    // Halation: alleen de felle plekken, kleine straal
    const tussen = this.maakTextuur(b, h, { float: true });
    const hal = this.maakTextuur(b, h, { float: true });
    const sigmaHal = Math.max(0.8, 0.003 * Math.max(b, h));
    this.vervaag(lin, tussen, [1 / b, 0], sigmaHal, true);
    this.vervaag(tussen, hal, [0, 1 / h], sigmaHal, false);

    // Bloom: eerst halveren tot rond 256 px, dan breed vervagen
    let klein = lin;
    while (Math.max(klein.b, klein.h) > BLOOM_ZIJDE * 1.5) {
      const half = this.maakTextuur(Math.max(1, Math.round(klein.b / 2)), Math.max(1, Math.round(klein.h / 2)), {
        float: true,
      });
      this.teken(this.prog.verkleinen, half, { invoer: klein.tex, doelGrootte: [half.b, half.h] });
      if (klein !== lin) this.verwijder(klein);
      klein = half;
    }
    const sigmaBloom = Math.max(1, 0.022 * Math.max(klein.b, klein.h));
    const bloomTussen = this.maakTextuur(klein.b, klein.h, { float: true });
    const bloom = this.maakTextuur(klein.b, klein.h, { float: true });
    this.vervaag(klein, bloomTussen, [1 / klein.b, 0], sigmaBloom, false);
    this.vervaag(bloomTussen, bloom, [0, 1 / klein.h], sigmaBloom, false);

    this.verwijder(tussen);
    this.verwijder(bloomTussen);
    if (klein !== lin) this.verwijder(klein);
    this.verwijder(lin);
    return { hal, bloom };
  }

  // beeld: ImageData van het verkleinde voorbeeld (sRGB, of P3-waarden als p3)
  laadFoto(beeld, { p3 = false, volledigeBreedte, volledigeHoogte, zaad = 1 }) {
    const bron = this.maakTextuur(beeld.width, beeld.height, { mips: true, data: beeld.data });
    return {
      bron,
      gloed: this.maakGloed(bron, p3),
      p3,
      volledigeBreedte,
      volledigeHoogte,
      zaad,
      grainCel: Math.min(volledigeBreedte, volledigeHoogte) / KORRELS_OP_KORTE_ZIJDE,
    };
  }

  verwijderFoto(foto) {
    if (!foto || this.verloren) return;
    this.verwijder(foto.bron);
    this.verwijder(foto.gloed.hal);
    this.verwijder(foto.gloed.bloom);
  }

  waarden(foto, bron, effecten) {
    return {
      bron: bron.tex,
      halation: foto.gloed.hal.tex,
      bloom: foto.gloed.bloom.tex,
      lut: this.lut,
      lutN: this.lutN,
      p3: foto.p3,
      glow: effecten.glow,
      grain: effecten.grain,
      vignet: effecten.vignet ?? VIGNET,
      grainCel: foto.grainCel,
      zaad: foto.zaad,
    };
  }

  tekenVoorbeeld(foto, effecten, { splitsing = -1, origineel = false } = {}) {
    if (!this.lut || !foto || this.verloren) return;
    const { width: b, height: h } = this.canvas;
    this.teken(this.prog.samenstellen, null, {
      ...this.waarden(foto, foto.bron, effecten),
      beeldGrootte: [b, h],
      uitGrootte: [b, h],
      tegelBegin: [0, 0],
      omkeren: true,
      grainSchaal: b / foto.volledigeBreedte,
      splitsing,
      origineel,
    });
  }

  // Zet een tekenbare bron (img, bitmap) op volle resolutie in een textuur. Het
  // gaat in tegels via een sRGB-2D-canvas: dat zet P3 om en past ook op iPhones
  // met een maximale canvasgrootte.
  async uploadInTegels(tekenbaar, doel) {
    const { gl } = this;
    const kanvas = document.createElement("canvas");
    kanvas.width = Math.min(TEGEL, doel.b);
    kanvas.height = Math.min(TEGEL, doel.h);
    const ctx = kanvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
    for (let y = 0; y < doel.h; y += TEGEL) {
      for (let x = 0; x < doel.b; x += TEGEL) {
        const w = Math.min(TEGEL, doel.b - x);
        const h = Math.min(TEGEL, doel.h - y);
        ctx.clearRect(0, 0, kanvas.width, kanvas.height);
        ctx.drawImage(tekenbaar, x, y, w, h, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        gl.bindTexture(gl.TEXTURE_2D, doel.tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
        await pauze();
      }
    }
    kanvas.width = 1;
    kanvas.height = 1;
  }

  // Rendert de hele foto. volledig: { tekenbaar, breedte, hoogte }. Met schaal < 1
  // wordt de uitvoer kleiner (voor apparaten die geen groot canvas aankunnen).
  async exporteer(foto, volledig, effecten, { schaal = 1, opVoortgang } = {}) {
    const { gl } = this;
    const bron = this.maakTextuur(volledig.breedte, volledig.hoogte, { mips: schaal < 1 });
    try {
      await this.uploadInTegels(volledig.tekenbaar, bron);
      if (schaal < 1) {
        gl.bindTexture(gl.TEXTURE_2D, bron.tex);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      const B = Math.max(1, Math.round(volledig.breedte * schaal));
      const H = Math.max(1, Math.round(volledig.hoogte * schaal));
      const doel = this.maakTextuur(Math.min(TEGEL, B), Math.min(TEGEL, H));
      const pixels = new Uint8Array(B * H * 4);
      const totaal = Math.ceil(B / TEGEL) * Math.ceil(H / TEGEL);
      let klaar = 0;
      try {
        for (let ty = 0; ty < H; ty += TEGEL) {
          for (let tx = 0; tx < B; tx += TEGEL) {
            const w = Math.min(TEGEL, B - tx);
            const h = Math.min(TEGEL, H - ty);
            this.teken(
              this.prog.samenstellen,
              doel,
              {
                ...this.waarden(foto, bron, effecten),
                beeldGrootte: [B, H],
                uitGrootte: [w, h],
                tegelBegin: [tx, ty],
                omkeren: false,
                grainSchaal: schaal,
                splitsing: -1,
                origineel: false,
              },
              [w, h],
            );
            // Rechtstreeks op de goede plek in de grote buffer: rij voor rij,
            // bovenste rij eerst, net zoals ImageData het wil
            gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
            gl.pixelStorei(gl.PACK_ROW_LENGTH, B);
            gl.pixelStorei(gl.PACK_SKIP_PIXELS, tx);
            gl.pixelStorei(gl.PACK_SKIP_ROWS, ty);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            gl.pixelStorei(gl.PACK_ROW_LENGTH, 0);
            gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0);
            gl.pixelStorei(gl.PACK_SKIP_ROWS, 0);
            opVoortgang?.(++klaar / totaal);
            await pauze();
          }
        }
      } finally {
        this.verwijder(doel);
      }
      if (this.verloren) throw new Error("De grafische kaart viel weg tijdens het bewaren.");
      return { pixels: new Uint8ClampedArray(pixels.buffer), breedte: B, hoogte: H };
    } finally {
      this.verwijder(bron);
    }
  }

  // Ruimt op, maar laat de context zelf heel: hetzelfde canvas kan daarna een
  // nieuwe renderer krijgen (React StrictMode bouwt componenten twee keer op)
  vernietig() {
    this.canvas.removeEventListener("webglcontextlost", this.bijVerlies);
    if (this.verloren) return;
    const { gl } = this;
    for (const { p } of Object.values(this.prog)) gl.deleteProgram(p);
    if (this.lut) gl.deleteTexture(this.lut);
    gl.deleteFramebuffer(this.fbo);
    gl.deleteVertexArray(this.vao);
  }
}
