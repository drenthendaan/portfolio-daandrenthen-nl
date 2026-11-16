// GLSL (WebGL2) voor de Thailand-filter. De keten per pixel:
// sRGB → lineair (P3 → sRGB als dat nodig is) → vignet → halation + bloom →
// 3D-LUT (de kleurlook uit look.mjs) → grain → dither.
//
// Alle texturen hebben de bovenkant van de foto op v = 0. Alleen het scherm
// staat andersom (y omhoog); daar draait `omkeren` het om.

const KOP = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
`;

const KLEUR = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 naarLineair(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 naarSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Display P3 → sRGB, beide lineair en D65 (kolom voor kolom)
const mat3 P3_NAAR_SRGB = mat3(
  1.2249401, -0.0420569, -0.0196376,
  -0.2249404, 1.0420571, -0.0786361,
  0.0, 0.0, 1.0982735
);
`;

// Eén driehoek over het hele beeld; de fragment-shaders werken met gl_FragCoord
export const VERTEX = `#version 300 es
in vec2 hoek;
void main() {
  gl_Position = vec4(hoek, 0.0, 1.0);
}
`;

// Verkleint de bron naar de gloed-resolutie en zet hem in lineair licht
export const VOORBEREIDEN = `${KOP}${KLEUR}
uniform sampler2D bron;
uniform vec2 doelGrootte;
uniform bool p3;
out vec4 uit;
void main() {
  vec3 lin = naarLineair(texture(bron, gl_FragCoord.xy / doelGrootte).rgb);
  if (p3) lin = max(P3_NAAR_SRGB * lin, 0.0);
  uit = vec4(lin, 1.0);
}
`;

// Halveert: het midden van een doelpixel valt precies tussen vier bronpixels
export const VERKLEINEN = `${KOP}
uniform sampler2D invoer;
uniform vec2 doelGrootte;
out vec4 uit;
void main() {
  uit = texture(invoer, gl_FragCoord.xy / doelGrootte);
}
`;

// Gaussische vervaging in één richting. Met drempel = true telt alleen wat fel
// is mee (halation ontstaat alleen rond de lichtste plekken).
export const VERVAGEN = `${KOP}
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
uniform sampler2D invoer;
uniform vec2 doelGrootte;
uniform vec2 richting;
uniform float sigma;
uniform int straal;
uniform bool drempel;
out vec4 uit;

vec3 lees(vec2 uv) {
  vec3 c = texture(invoer, uv).rgb;
  if (drempel) {
    float y = dot(c, LUMA);
    c = vec3(y * smoothstep(0.55, 1.1, y));
  }
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / doelGrootte;
  vec3 som = lees(uv);
  float gewicht = 1.0;
  for (int i = 1; i <= 64; i++) {
    if (i > straal) break;
    float x = float(i);
    float w = exp(-(x * x) / (2.0 * sigma * sigma));
    vec2 d = richting * x;
    som += w * (lees(uv + d) + lees(uv - d));
    gewicht += 2.0 * w;
  }
  uit = vec4(som / gewicht, 1.0);
}
`;

export const SAMENSTELLEN = `${KOP}${KLEUR}
uniform sampler2D bron;
uniform sampler2D halation;
uniform sampler2D bloom;
uniform sampler3D lut;
uniform int lutN;

uniform vec2 beeldGrootte; // de hele uitvoer, in uitvoerpixels
uniform vec2 uitGrootte; // dit doel (scherm of tegel)
uniform vec2 tegelBegin; // linksboven van deze tegel, in uitvoerpixels
uniform bool omkeren; // scherm: y loopt omhoog

uniform bool p3;
uniform float glow;
uniform float grain;
uniform float vignet;
uniform float grainCel; // grootte van een grainkorrel, in pixels van de volle foto
uniform float grainSchaal; // uitvoerpixels per pixel van de volle foto
uniform float zaad;

uniform float splitsing; // links hiervan (0–1) het origineel; −1 = uit
uniform bool origineel;

out vec4 uit;

// Snelle integer-hash (PCG): zelfde pixel + zaad geeft altijd dezelfde ruis,
// dus tegels sluiten naadloos aan en het voorbeeld klopt met de export
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

float hash(vec2 p, uint z) {
  uvec2 q = uvec2(ivec2(floor(p)) + ivec2(65536));
  return float(pcg(q.x + pcg(q.y + pcg(z)))) / 4294967295.0;
}

float waardeRuis(vec2 p, uint z) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i, z);
  float b = hash(i + vec2(1.0, 0.0), z);
  float c = hash(i + vec2(0.0, 1.0), z);
  float d = hash(i + vec2(1.0, 1.0), z);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) - 0.5;
}

vec3 lutTexel(ivec3 p) {
  return texelFetch(lut, p, 0).rgb;
}

// Tetraëdrische interpolatie: hetzelfde algoritme als tetraedrisch() in cube.mjs
vec3 lutOpzoeken(vec3 c) {
  float s = float(lutN - 1);
  vec3 p = clamp(c, 0.0, 1.0) * s;
  vec3 b = min(floor(p), vec3(s - 1.0));
  vec3 f = p - b;
  ivec3 i = ivec3(b);
  vec3 c000 = lutTexel(i);
  vec3 c111 = lutTexel(i + ivec3(1));
  if (f.r > f.g) {
    if (f.g > f.b) {
      return (1.0 - f.r) * c000 + (f.r - f.g) * lutTexel(i + ivec3(1, 0, 0)) + (f.g - f.b) * lutTexel(i + ivec3(1, 1, 0)) + f.b * c111;
    } else if (f.r > f.b) {
      return (1.0 - f.r) * c000 + (f.r - f.b) * lutTexel(i + ivec3(1, 0, 0)) + (f.b - f.g) * lutTexel(i + ivec3(1, 0, 1)) + f.g * c111;
    }
    return (1.0 - f.b) * c000 + (f.b - f.r) * lutTexel(i + ivec3(0, 0, 1)) + (f.r - f.g) * lutTexel(i + ivec3(1, 0, 1)) + f.g * c111;
  }
  if (f.b > f.g) {
    return (1.0 - f.b) * c000 + (f.b - f.g) * lutTexel(i + ivec3(0, 0, 1)) + (f.g - f.r) * lutTexel(i + ivec3(0, 1, 1)) + f.r * c111;
  } else if (f.b > f.r) {
    return (1.0 - f.g) * c000 + (f.g - f.b) * lutTexel(i + ivec3(0, 1, 0)) + (f.b - f.r) * lutTexel(i + ivec3(0, 1, 1)) + f.r * c111;
  }
  return (1.0 - f.g) * c000 + (f.g - f.r) * lutTexel(i + ivec3(0, 1, 0)) + (f.r - f.b) * lutTexel(i + ivec3(1, 1, 0)) + f.b * c111;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, omkeren ? uitGrootte.y - gl_FragCoord.y : gl_FragCoord.y);
  vec2 px = frag + tegelBegin;
  vec2 uv = px / beeldGrootte;
  uint z = uint(zaad);

  vec3 lin = naarLineair(texture(bron, uv).rgb);
  if (p3) lin = max(P3_NAAR_SRGB * lin, 0.0);

  vec3 kleur;
  if (origineel || uv.x < splitsing) {
    kleur = naarSrgb(lin);
  } else {
    // Vignet: licht valt naar de hoeken iets af, zoals bij een echte lens
    vec2 m = (uv - 0.5) * 2.0 * beeldGrootte / max(beeldGrootte.x, beeldGrootte.y);
    lin *= 1.0 - vignet * smoothstep(0.35, 1.0, length(m) * 0.7071);

    // Halation: de rood-oranje halo die vanaf felle plekken overloopt naar donkere
    // buren. Alleen het overloopdeel telt (vervaagd min wat hier zelf al fel is),
    // anders kleurt een grote lichte lucht in zijn geheel oranje.
    float y = dot(lin, LUMA);
    float overloop = max(texture(halation, uv).r - y * smoothstep(0.55, 1.1, y), 0.0);
    lin += overloop * vec3(1.0, 0.34, 0.12) * 0.9 * glow;
    // Bloom: een zachte waas over alles
    lin = mix(lin, texture(bloom, uv).rgb, 0.12 * glow);

    // Alleen halation kan boven 1 uitkomen, en alleen waar het al wit is: afkappen
    // is daar onzichtbaar. Zonder gloed is dit precies de LUT, en dus de .cube.
    kleur = lutOpzoeken(naarSrgb(min(lin, 1.0)));

    // Grain: korrels van vaste grootte op de volle foto. In een verkleind
    // voorbeeld vallen er meerdere in één pixel; die middelen uit, dus de ruis
    // wordt daar zwakker, net als wanneer je de echte foto verkleind bekijkt.
    if (grain > 0.0) {
      float cel = grainCel * grainSchaal;
      vec2 p = px / max(cel, 1.0);
      float korrel = waardeRuis(p, z) + 0.5 * waardeRuis(p * 2.03 + 17.0, z + 7u);
      vec3 kleurKorrel = vec3(waardeRuis(p + 31.0, z + 11u), waardeRuis(p + 57.0, z + 13u), waardeRuis(p + 83.0, z + 17u));
      vec3 g = korrel * 0.8 + kleurKorrel * 0.25;
      float y = dot(kleur, LUMA);
      float midden = 0.35 + 0.65 * 4.0 * y * (1.0 - y);
      kleur += g * grain * 0.16 * midden * min(cel, 1.0);
    }
  }

  // Driehoeksruis van ±1 niveau tegen banding in luchten
  kleur += (hash(px, z + 101u) - hash(px, z + 202u)) / 255.0;
  uit = vec4(clamp(kleur, 0.0, 1.0), 1.0);
}
`;
