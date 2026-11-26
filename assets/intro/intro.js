/* Samruk Travel intro.
   Earth close-up → dive through the clouds to just above Kazakhstan → Kazakhstan lights
   up → departure → the camera swings in behind the climbing airliner while the Earth below
   gives way to blue sky → level flight → the smoke trail writes "Samruk Travel" in clouds. When the intro ends the
   same canvas stays behind the page as the sky, and the cloud title keeps billowing.

   Page contract (index.html):
     canvas#sky3d        fixed full-screen canvas behind the page
     #intro              overlay: #introSkip, #introTag, #introLoad
     #heroSky            transparent stage in the hero; the cloud title is centred on it
     html.intro-pending  set by an inline script; this module swaps it for
                         html.intro-playing and then html.intro-done
*/
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { KZ_BORDER } from './kz-border.js';

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/';
const asset = (f) => new URL(f, import.meta.url).href;

/* ------------------------------------------------------------------ helpers */
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const backOut = (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Unit vector for a latitude/longitude, matching three's SphereGeometry UV layout. */
function latLonDir(lat, lon, out = new THREE.Vector3()) {
  const phi = (lon + 180) * D2R, th = (90 - lat) * D2R;
  return out.set(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
}
const col = (hex) => new THREE.Color(hex);

/* ------------------------------------------------------------------ timeline (s) */
const T = {
  spinEnd: 2.4,      // Earth close-up spin
  diveEnd: 4.7,      // dive through the clouds, settle just above Kazakhstan
  kzIn: 4.5, kzRise: 4.8, kzRiseEnd: 5.7,
  dot: 5.4, tagIn: 5.65, tagOut: 7.5,
  planeStart: 6.1,   // take-off from the dot
  chase: 7.5, chaseEnd: 9.4,   // camera swings in beside the climbing airliner
  swap: 9.4, blendEnd: 10.6,   // Earth below dissolves into the cloud sea and blue sky
};
const SKY_CRUISE = 3.2;    // level flight, seconds after the swap
const MORPH = 1.35;        // trail → letter morph time

/* ------------------------------------------------------------------ DOM */
const root = document.documentElement;
const canvas = document.getElementById('sky3d');
const $ = (s) => document.querySelector(s);
const ui = { skip: $('#introSkip'), tag: $('#introTag'), load: $('#introLoad'), bar: $('#introBar'), stage: $('#heroSky') };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : darkMQ.matches);
const hashView = (location.hash || '').slice(1);
const wantIntro = root.classList.contains('intro-pending') && !reduceMotion && (!hashView || hashView === 'top');

/* ------------------------------------------------------------------ renderer */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  fail(e);
}
const small = Math.min(innerWidth, innerHeight) < 700;
const DPR = Math.min(devicePixelRatio || 1, small ? 2 : 1.6);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x02040a, 1);

function fail(err) {
  console.warn('[intro] falling back to the static sky:', err);
  root.classList.add('no-webgl');
  finishPage();
  throw err;
}

/* ------------------------------------------------------------------ noise + puff atlas */
function valueNoise(seed) {
  const r = rng(seed), G = 64, g = new Float32Array(G * G);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const at = (a, b) => g[((b & 63) * G) + (a & 63)];
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
  };
}

/** 2×2 atlas of cumulus puffs. RG = normal, B = thickness, A = coverage.
    Variants 0-1: cumulus domes with a soft flat base, 2: wide flat heap, 3: round puff. */
function makePuffAtlas() {
  const N = 128, S = N * 2, data = new Uint8Array(S * S * 4);
  const r = rng(11);
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * N, oy = Math.floor(v / 2) * N;
    const n1 = valueNoise(100 + v), n2 = valueNoise(200 + v), n3 = valueNoise(300 + v);
    const blobs = [];
    const wide = v === 2 ? 0.36 : v === 3 ? 0.24 : 0.31;
    const nb = v === 3 ? 26 : 34;
    for (let i = 0; i < nb; i++) {
      const fx = (r() - 0.5) * 2;
      const x = 0.5 + fx * wide * (0.75 + 0.25 * r());
      let y, rad;
      if (v === 3) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.2;
        rad = 0.07 + r() * 0.08;
        blobs.push([0.5 + Math.cos(a) * d, 0.5 + Math.sin(a) * d, rad]);
        continue;
      }
      const dome = 1 - Math.pow(Math.abs(fx), 1.6);
      const top = v === 2 ? 0.5 + 0.12 * dome : 0.36 + 0.36 * dome;
      y = 0.3 + r() * (top - 0.3);
      rad = (0.045 + r() * 0.085) * (0.65 + 0.35 * dome);
      blobs.push([x, y, rad]);
    }
    const H = new Float32Array(N * N);
    let hMax = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const px = (x + 0.5) / N, py = (y + 0.5) / N;
        let h = 0;
        for (const [bx, by, br] of blobs) {
          const d2 = (px - bx) ** 2 + (py - by) ** 2;
          if (d2 < br * br) h = Math.max(h, Math.sqrt(br * br - d2) + by * 0.08);
        }
        if (h > 0) h += (n1(px * 18, py * 18) - 0.5) * 0.026 + (n2(px * 44, py * 44) - 0.5) * 0.012;
        if (v !== 3) h *= sstep(0.2, 0.34, py);          // soft flat base
        h *= sstep(0.5, 0.42, Math.hypot(px - 0.5, py - 0.5));
        H[y * N + x] = Math.max(0, h);
        hMax = Math.max(hMax, h);
      }
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const h = H[y * N + x];
        const hx = H[y * N + Math.min(N - 1, x + 1)] - H[y * N + Math.max(0, x - 1)];
        const hy = H[Math.min(N - 1, y + 1) * N + x] - H[Math.max(0, y - 1) * N + x];
        const k = 34;
        let nx = -hx * k, ny = -hy * k;
        const l = Math.hypot(nx, ny, 1);
        nx /= l; ny /= l;
        const px = (x + 0.5) / N, py = (y + 0.5) / N;
        const fray = (n3(px * 26, py * 26) - 0.5) * 0.05;
        const o = ((oy + y) * S + ox + x) * 4;
        data[o] = Math.round((nx * 0.5 + 0.5) * 255);
        data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[o + 2] = Math.round(clamp(h / hMax, 0, 1) * 255);
        data[o + 3] = Math.round(Math.pow(sstep(0.0, 0.085, h + fray * sstep(0.0, 0.05, h)), 1.25) * 255);
      }
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
const ATLAS = makePuffAtlas();

/* ------------------------------------------------------------------ puff shaders */
const PUFF_VERT = /* glsl */`
attribute vec3 aPos;
attribute vec4 aD;   // size, rotation, atlas variant, brightness
attribute vec4 aE;   // rim, alpha, stretch, random
#ifdef TEXT
attribute vec3 aStart;
attribute vec4 aT;   // release time, hold, seed, wisp flag
uniform float uMorph;
#endif
#ifdef CLOUD
uniform vec3 uCam;
uniform float uViewW, uDist, uWind;
#endif
uniform float uTime, uFogNear, uFogFar, uFogMax;
varying vec2 vUv;
varying float vAlpha, vRot, vBright, vRim, vFog;
void main() {
  vec3 p = aPos;
  float size = aD.x, rot = aD.y, alpha = aE.y, stretch = aE.z;
#ifdef CLOUD
  float depth = max(uCam.z - p.z, 1.0);
  float wrap = uViewW * depth / uDist * 1.8 + size * 2.0;
  p.x += uWind * uTime * (0.55 + aE.w);
  p.x = uCam.x + mod(p.x - uCam.x + wrap * 0.5, wrap) - wrap * 0.5;
  p.y += sin(uTime * 0.23 + aE.w * 17.0) * size * 0.025;
  rot += uTime * 0.012 * (aE.w - 0.5);
#endif
#ifdef TEXT
  float sd = aT.z * 6.2831;
  float vis = step(aT.x, uTime);
  float k = clamp((uTime - aT.x - aT.y) / uMorph, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - k, 3.0);
  p = mix(aStart, aPos, e);
  float b = smoothstep(0.15, 1.0, k);
  p += vec3(sin(uTime * 0.71 + sd), sin(uTime * 0.53 + sd * 1.7), sin(uTime * 0.47 + sd * 0.6)) * size * 0.06 * b;
  size *= vis * mix(0.2, 1.0, smoothstep(0.0, 0.85, k)) * (1.0 + 0.07 * sin(uTime * 0.8 + sd));
  alpha *= mix(0.9, 1.0, k);
  stretch = mix(2.4, stretch, smoothstep(0.0, 0.55, k));
  rot += uTime * 0.03 * (aT.z - 0.5);
  if (aT.w > 1.5) {
    // trail smoke: swells a little and fades away
    alpha *= 1.0 - smoothstep(0.1, 0.9, k);
    size = aD.x * vis * (0.45 + k * 1.1);
    stretch = mix(2.0, 1.2, k);
  } else if (aT.w > 0.5) {
    // wisps curling off the top edges
    float life = fract(uTime * 0.1 + aT.z * 3.7);
    p.y += life * size * 2.0;
    p.x += sin(life * 2.6 + sd) * size * 0.35 + life * size * 0.4;
    alpha *= sin(life * 3.1416) * 0.3 * b;
    size *= 0.45 + life * 0.75;
    stretch = 0.55;
  }
#endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float c = cos(rot), s = sin(rot);
  mv.xy += (mat2(c, s, -s, c) * position.xy) * size * vec2(stretch, 1.0);
  gl_Position = projectionMatrix * mv;
  vUv = (uv + vec2(mod(aD.z, 2.0), floor(aD.z * 0.5))) * 0.5;
  vRot = rot; vBright = aD.w; vRim = aE.x; vAlpha = alpha;
  vFog = clamp((-mv.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0) * uFogMax;
}`;

const PUFF_FRAG = /* glsl */`
uniform sampler2D uAtlas;
uniform vec3 uLit, uShade, uRim, uFog, uLight;
uniform float uOpacity;
varying vec2 vUv;
varying float vAlpha, vRot, vBright, vRim, vFog;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float a = t.a * vAlpha * uOpacity;
  if (a < 0.004) discard;
  vec2 n2 = t.rg * 2.0 - 1.0;
  float c = cos(vRot), s = sin(vRot);
  n2 = mat2(c, s, -s, c) * n2;
  vec3 n = vec3(n2, sqrt(max(0.0, 1.0 - dot(n2, n2))));
  float dif = clamp(dot(n, uLight) * 0.62 + 0.42, 0.0, 1.0) * vBright;
  vec3 col = mix(uShade, uLit, smoothstep(0.08, 0.95, dif));
  col = mix(col, uRim, clamp((1.0 - t.b) * vRim, 0.0, 1.0));
  col = mix(col, uFog, vFog);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

function puffMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: PUFF_VERT,
    fragmentShader: PUFF_FRAG,
    defines: o.defines || {},
    uniforms: {
      uAtlas: { value: ATLAS },
      uTime: { value: 0 },
      uLit: { value: col(o.lit || '#ffffff') },
      uShade: { value: col(o.shade || '#a898d9') },
      uRim: { value: col(o.rim || '#000000') },
      uFog: { value: col(o.fog || '#c5c6ea') },
      uLight: { value: new THREE.Vector3(-0.5, 0.62, 0.6).normalize() },
      uOpacity: { value: o.opacity ?? 1 },
      uFogNear: { value: o.fogNear ?? 0 }, uFogFar: { value: o.fogFar ?? 1 }, uFogMax: { value: o.fogMax ?? 0 },
      uMorph: { value: MORPH },
      uCam: { value: new THREE.Vector3() }, uViewW: { value: 40 }, uDist: { value: 40 }, uWind: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: o.blending ?? THREE.NormalBlending,
    toneMapped: false,
  });
}

function instancedQuad(n) {
  const g = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  g.instanceCount = n;
  return g;
}

/** Puffs whose attributes are rewritten from JS every frame (trails, wipes). */
class PuffBatch {
  constructor(cap, mat, order = 0) {
    this.cap = cap;
    this.g = instancedQuad(0);
    this.pos = new Float32Array(cap * 3);
    this.d = new Float32Array(cap * 4);
    this.e = new Float32Array(cap * 4);
    for (const [name, arr, n] of [['aPos', this.pos, 3], ['aD', this.d, 4], ['aE', this.e, 4]]) {
      this.g.setAttribute(name, new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
    }
    this.mesh = new THREE.Mesh(this.g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
    this.mat = mat;
    this.n = 0;
  }
  begin() { this.n = 0; }
  push(x, y, z, size, rot, variant, bright, rim, alpha, stretch = 1) {
    if (this.n >= this.cap || alpha <= 0.002 || size <= 0) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.d.set([size, rot, variant, bright], i * 4);
    this.e.set([rim, alpha, stretch, 0], i * 4);
  }
  end() {
    this.g.instanceCount = this.n;
    for (const k of ['aPos', 'aD', 'aE']) {
      const a = this.g.attributes[k];
      a.needsUpdate = true;
    }
  }
}

/* ------------------------------------------------------------------ assets */
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, done, total) => { if (ui.bar) ui.bar.style.transform = `scaleX(${(done / total).toFixed(3)})`; };
const texLoader = new THREE.TextureLoader(manager);
const loadTex = (f, srgb) => texLoader.loadAsync(asset(f)).then((t) => {
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
});
const fontReady = (async () => {
  try {
    await Promise.race([document.fonts.load('700 200px "Fredoka"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch (e) { /* fall back to the next font in the stack */ }
})();

/* ------------------------------------------------------------------ palettes */
function palette(dark) {
  return dark ? {
    top: '#26336a', mid: '#333a7a', low: '#4d4489', haze: '#6f659f', sun: '#9fa8ff',
    lit: '#dcd8f5', shade: '#4f4687', rim: '#6d5fb0', fog: '#433f7a',
    tLit: '#f4f1ff', tShade: '#7f6dc8', tRim: '#a58ae6', tDrop: '#120d33',
  } : {
    top: '#a9bdec', mid: '#8f9bd8', low: '#aaa4da', haze: '#dcd7f1', sun: '#fff1df',
    lit: '#ffffff', shade: '#a898d9', rim: '#c9b9ee', fog: '#c3c3e8',
    tLit: '#ffffff', tShade: '#9b86dd', tRim: '#c6aef0', tDrop: '#3b2d82',
  };
}

/* ================================================================== SPACE */
const space = { scene: new THREE.Scene() };
space.cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 400);
space.earth = new THREE.Group();
space.scene.add(space.earth);
const SUN_WORLD = latLonDir(12, 30);
const KZ_H = 0.009;                       // extrusion height (Earth radius = 1)
const ASTANA = latLonDir(51.17, 71.43);

function buildStars() {
  const n = 4200, r = rng(3);
  const pos = new Float32Array(n * 3), sz = new Float32Array(n), tint = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 150, u * 150, Math.sin(a) * s * 150], i * 3);
    sz[i] = Math.pow(r(), 6) * 3.2 + 0.7;
    tint[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: DPR } },
    vertexShader: /* glsl */`
      attribute float aSize, aTint; uniform float uTime, uPx; varying float vA; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPx; vA = 0.55 + 0.45 * sin(uTime * (1.0 + aTint * 3.0) + aTint * 40.0);
        vC = mix(vec3(0.75,0.85,1.0), vec3(1.0,0.9,0.75), aTint); }`,
    fragmentShader: /* glsl */`
      varying float vA; varying vec3 vC;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(vC * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  space.stars = new THREE.Points(g, m);
  space.scene.add(space.stars);

  // sun glare
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.08, 'rgba(255,246,225,.9)');
  gr.addColorStop(0.3, 'rgba(255,214,150,.22)');
  gr.addColorStop(1, 'rgba(255,200,120,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 256, 256);
  const st = new THREE.CanvasTexture(c);
  st.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: new THREE.Color(3, 2.8, 2.5), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sun.position.copy(SUN_WORLD).multiplyScalar(120);
  sun.scale.setScalar(26);
  space.scene.add(sun);
}

const EARTH_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vPos;
void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const EARTH_FRAG = /* glsl */`
uniform sampler2D uDay, uNight, uWater, uBump, uClouds;
uniform vec3 uSun, uCam;
uniform float uCloudShift;
varying vec2 vUv; varying vec3 vPos;
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main(){
  vec3 N0 = normalize(vPos);
  float h = texture2D(uBump, vUv).r;
  vec3 dpx = dFdx(vPos), dpy = dFdy(vPos);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, N0), r2 = cross(N0, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  vec3 N = normalize(abs(det) * N0 - 0.022 * grad);

  vec3 L = normalize(uSun), V = normalize(uCam - vPos);
  float ndl0 = dot(N0, L), ndl = dot(N, L);
  float day = smoothstep(-0.14, 0.2, ndl0);

  vec3 albedo = texture2D(uDay, vUv).rgb;
  float water = texture2D(uWater, vUv).r;
  albedo = mix(albedo, albedo * vec3(0.72, 0.86, 1.05), water * 0.6);
  // fine terrain detail so the land stays crisp when the camera is close
  float fine = vnoise(vPos * 260.0) * 0.5 + vnoise(vPos * 820.0) * 0.32 + vnoise(vPos * 2300.0) * 0.18;
  albedo *= mix(1.0, 0.84 + 0.32 * fine, 1.0 - water);

  // cloud shadows: sample the cloud map a little toward the sun
  vec3 east = normalize(vec3(-N0.z, 0.0, N0.x) + 1e-5);
  vec3 north = cross(N0, east);
  vec2 sh = vec2(dot(L, east), dot(L, north)) * 0.0035;
  vec2 cuv = vec2(vUv.x + uCloudShift, vUv.y);
  float cl = texture2D(uClouds, cuv).r;
  float cls = texture2D(uClouds, cuv - vec2(sh.x, -sh.y)).r;

  vec3 c = albedo * (max(ndl, 0.0) * 1.35 + 0.012) * (1.0 - cls * 0.55 * day);
  vec3 H = normalize(L + V);
  float nh = max(dot(N0, H), 0.0);
  float spec = pow(nh, 160.0) * 1.3 + pow(nh, 22.0) * 0.06;
  c += vec3(1.0, 0.9, 0.75) * spec * water * day * (1.0 - cl);

  float lights = texture2D(uNight, vUv).r;
  c += vec3(1.0, 0.7, 0.36) * pow(lights, 1.7) * 1.6 * (1.0 - smoothstep(-0.25, 0.08, ndl0)) * (1.0 - cl * 0.8);

  // air seen through at a slant: a thin veil over the disc that thickens and pales toward the limb
  float mu = max(dot(N0, V), 0.0);
  float fres = pow(1.0 - mu, 2.2);
  vec3 sky = mix(vec3(0.27, 0.5, 0.98), vec3(0.6, 0.77, 1.0), fres);
  c = mix(c, sky * (0.1 + 0.8 * day), clamp(fres * 0.62 + 0.05 * day, 0.0, 1.0) * smoothstep(-0.4, 0.3, ndl0));
  float dusk = smoothstep(-0.3, 0.02, ndl0) * (1.0 - smoothstep(0.02, 0.36, ndl0));
  c = mix(c, c * vec3(1.25, 0.82, 0.62) + vec3(0.06, 0.025, 0.01) * fres, dusk * 0.6);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CLOUD_FRAG = /* glsl */`
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uCloudShift, uOpacity;
varying vec2 vUv; varying vec3 vPos;
void main(){
  vec3 N0 = normalize(vPos);
  float c = texture2D(uClouds, vec2(vUv.x + uCloudShift, vUv.y)).r;
  c = smoothstep(0.1, 0.85, c);
  float ndl = dot(N0, normalize(uSun));
  float lit = smoothstep(-0.16, 0.32, ndl);
  vec3 cc = mix(vec3(0.02, 0.03, 0.06), vec3(1.05), lit);
  cc = mix(cc, vec3(1.0, 0.58, 0.32), smoothstep(0.28, 0.02, ndl) * smoothstep(-0.18, 0.02, ndl) * 0.85);
  gl_FragColor = vec4(cc, c * 0.93 * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const ATMO_VERT = /* glsl */`
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// glow from how close each view ray passes to the planet: brightest right at the limb
const ATMO_FRAG = /* glsl */`
uniform vec3 uSunW, uCamW;
varying vec3 vW;
void main(){
  vec3 rd = normalize(vW - uCamW);
  float tc = max(dot(-uCamW, rd), 0.0);
  vec3 pc = uCamW + rd * tc;               // closest point of the ray to the centre
  float b = length(pc);
  float h = b - 1.0;                         // lowest altitude the ray reaches
  float x = max(h, 0.0) / 0.16;
  // optical depth falls off smoothly with height: a dense, bright core and a long soft tail
  float g = exp(-x * 4.0) * 0.85 + exp(-x * 1.5) * 0.13;
  g *= smoothstep(-0.035, 0.02, h);          // fades into the planet instead of a hard edge
  float lit = smoothstep(-0.45, 0.7, dot(normalize(pc), normalize(uSunW)));
  // low air is pale, almost white-blue; higher up it deepens to blue, then fades into space
  vec3 day = mix(vec3(0.56, 0.75, 1.0), vec3(0.17, 0.37, 0.96), smoothstep(0.0, 0.75, x));
  vec3 c = mix(vec3(0.025, 0.05, 0.17), day, lit) * g * (0.18 + 1.0 * lit);
  // warm tint along the terminator, mixed in rather than added, so it stays a tint
  c = mix(c, c * vec3(1.3, 0.86, 0.68), lit * (1.0 - lit) * 4.0 * 0.4);
  gl_FragColor = vec4(c, 1.0);
}`;

function buildEarth(tex) {
  const g = new THREE.SphereGeometry(1, 256, 128);
  space.earthMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      uDay: { value: tex.day }, uNight: { value: tex.night }, uWater: { value: tex.water }, uBump: { value: tex.bump }, uClouds: { value: tex.clouds },
      uSun: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() }, uCloudShift: { value: 0 },
    },
  });
  space.earth.add(new THREE.Mesh(g, space.earthMat));

  space.cloudMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: { uClouds: { value: tex.clouds }, uSun: { value: new THREE.Vector3() }, uCloudShift: { value: 0 }, uOpacity: { value: 1 } },
    transparent: true, depthWrite: false,
  });
  const cl = new THREE.Mesh(new THREE.SphereGeometry(1.006, 192, 96), space.cloudMat);
  cl.renderOrder = 2;
  space.earth.add(cl);

  space.atmoMat = new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: { uSunW: { value: SUN_WORLD }, uCamW: { value: new THREE.Vector3() } },
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const at = new THREE.Mesh(new THREE.SphereGeometry(1.19, 128, 64), space.atmoMat);
  at.renderOrder = 1;
  space.earth.add(at);
}

/* -------------------------------- Kazakhstan: glowing, raised map */
function buildKazakhstan(dayTex) {
  const ring = [];
  for (let i = 0; i < KZ_BORDER.length; i += 2) ring.push(new THREE.Vector2(KZ_BORDER[i], KZ_BORDER[i + 1]));
  if (THREE.ShapeUtils.isClockWise(ring)) ring.reverse();
  const tris = THREE.ShapeUtils.triangulateShape(ring, []);

  // subdivide in lon/lat until edges are short, so the cap follows the curvature
  const verts = ring.map((v) => [v.x, v.y]);
  const cache = new Map();
  const mid = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (!cache.has(k)) { cache.set(k, verts.length); verts.push([(verts[a][0] + verts[b][0]) / 2, (verts[a][1] + verts[b][1]) / 2]); }
    return cache.get(k);
  };
  const len = (a, b) => Math.hypot((verts[a][0] - verts[b][0]) * Math.cos(verts[a][1] * D2R), verts[a][1] - verts[b][1]);
  const out = [];
  // longest-edge bisection: ear clipping leaves long slivers, this splits them cheaply
  const split = (a, b, c, depth) => {
    const lab = len(a, b), lbc = len(b, c), lca = len(c, a);
    const m = Math.max(lab, lbc, lca);
    if (m < 1.2 || depth > 16) { out.push(a, b, c); return; }
    if (m === lab) { const d = mid(a, b); split(a, d, c, depth + 1); split(d, b, c, depth + 1); }
    else if (m === lbc) { const d = mid(b, c); split(a, b, d, depth + 1); split(a, d, c, depth + 1); }
    else { const d = mid(c, a); split(a, b, d, depth + 1); split(d, b, c, depth + 1); }
  };
  for (const [a, b, c] of tris) split(a, b, c, 0);

  // distance of each cap vertex to the border, for the inner glow
  const segDist = (px, py) => {
    let best = 1e9;
    const cx = Math.cos(py * D2R);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const ax = (a.x - px) * cx, ay = a.y - py, bx = (b.x - px) * cx, by = b.y - py;
      const dx = bx - ax, dy = by - ay;
      const t = clamp(-(ax * dx + ay * dy) / (dx * dx + dy * dy + 1e-9), 0, 1);
      best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t));
    }
    return best;
  };

  const pos = [], top = [], edge = [], wall = [];
  const tmp = new THREE.Vector3();
  const pushV = (lon, lat, t, e, w) => { latLonDir(lat, lon, tmp); pos.push(tmp.x, tmp.y, tmp.z); top.push(t); edge.push(e); wall.push(w); };
  const capIdx = [];
  const nCap = verts.length;
  for (const [lon, lat] of verts) pushV(lon, lat, 1, segDist(lon, lat), 0);
  for (const i of out) capIdx.push(i);
  // walls
  const idx = capIdx.slice();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const base = pos.length / 3;
    pushV(a.x, a.y, 0, 0, 1); pushV(b.x, b.y, 0, 0, 1); pushV(b.x, b.y, 1, 0, 1); pushV(a.x, a.y, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('aWall', new THREE.Float32BufferAttribute(wall, 1));
  g.setIndex(idx);
  space.kzMat = new THREE.ShaderMaterial({
    uniforms: { uRise: { value: 0 }, uH: { value: KZ_H }, uTime: { value: 0 }, uAlpha: { value: 0 }, uDay: { value: dayTex }, uSun: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */`
      attribute float aTop, aEdge, aWall; uniform float uRise, uH;
      varying float vTop, vEdge, vWall; varying vec3 vDir;
      void main(){ vec3 d = normalize(position); vDir = d; vTop = aTop; vEdge = aEdge; vWall = aWall;
        float r = 1.0015 + aTop * uH * uRise;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(d * r, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uDay; uniform vec3 uSun; uniform float uTime, uAlpha, uRise;
      varying float vTop, vEdge, vWall; varying vec3 vDir;
      void main(){
        vec3 gold = vec3(1.0, 0.68, 0.1);
        vec2 uv = vec2(fract(atan(vDir.z, -vDir.x) / 6.28318531), 1.0 - acos(clamp(vDir.y, -1.0, 1.0)) / 3.14159265);
        float lum = dot(texture2D(uDay, uv).rgb, vec3(0.3, 0.59, 0.11));
        float lit = clamp(dot(vDir, normalize(uSun)) * 0.7 + 0.55, 0.45, 1.15);
        vec3 c;
        float a = uAlpha;
        if (vWall > 0.5) {
          c = gold * (0.9 + 1.5 * vTop) * (0.4 + 0.6 * uRise);
        } else {
          float edge = exp(-vEdge * 3.2);
          float sweep = exp(-pow((vDir.x * 0.7 + vDir.y * 0.7 + vDir.z * 0.1) * 7.0 - mod(uTime * 1.3, 18.0) + 9.0, 2.0) * 1.2);
          c = gold * (0.12 + lum * 1.1) * lit + gold * edge * 1.3 + vec3(1.0, 0.85, 0.5) * sweep * 0.3;
          a *= 0.42 + 0.45 * edge;
        }
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  space.kz = new THREE.Mesh(g, space.kzMat);
  space.kz.renderOrder = 3;
  space.earth.add(space.kz);

  // light curtain rising above the border
  const cp = [], cv = [], ci = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const base = cp.length / 3;
    for (const [p, v] of [[a, 0], [b, 0], [b, 1], [a, 1]]) { latLonDir(p.y, p.x, tmp); cp.push(tmp.x, tmp.y, tmp.z); cv.push(v); }
    ci.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cg.setAttribute('aV', new THREE.Float32BufferAttribute(cv, 1));
  cg.setIndex(ci);
  space.curtainMat = new THREE.ShaderMaterial({
    uniforms: { uBase: { value: 1.0 }, uHc: { value: 0.05 }, uAmt: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aV; uniform float uBase, uHc; varying float vV;
      void main(){ vV = aV; vec3 d = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(d * (uBase + aV * uHc), 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uAmt; varying float vV;
      void main(){ float a = pow(1.0 - vV, 2.2) * uAmt; gl_FragColor = vec4(vec3(1.0, 0.72, 0.18) * 1.8 * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  space.curtain = new THREE.Mesh(cg, space.curtainMat);
  space.curtain.renderOrder = 4;
  space.earth.add(space.curtain);

  // departure dot + pulse rings
  space.dot = new THREE.Group();
  const dotM = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.6), toneMapped: false }));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.022, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.3), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  space.dot.add(dotM, halo);
  space.rings = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.4, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    space.dot.add(m);
    return m;
  });
  space.dot.position.copy(ASTANA).multiplyScalar(1.0015 + KZ_H + 0.002);
  space.dot.lookAt(ASTANA.clone().multiplyScalar(3));
  space.dot.scale.setScalar(0.0001);
  space.earth.add(space.dot);
}

/* -------------------------------- low cumulus over Central Asia, seen in the last part of the approach.
   Small, flattened puffs sit right on the cloud shell, only where the cloud map itself has cloud,
   so they read as the same clouds gaining relief rather than a separate layer floating in space. */
function buildDiveClouds(cloudTex) {
  const mat = puffMaterial({ lit: '#ffffff', shade: '#b4c2db', rim: '#e4ebf6', fog: '#a7c6ee', fogNear: 0.22, fogFar: 1.25, fogMax: 0.5 });
  mat.uniforms.uOpacity.value = 0;
  space.diveMat = mat;
  space.diveGroup = new THREE.Group();
  space.earth.add(space.diveGroup);

  // read cloud cover for the region the camera flies over
  const LAT0 = 28, LAT1 = 64, LON0 = 38, LON1 = 98;
  let cover = () => 0.5;
  const img = cloudTex && cloudTex.image;
  if (img && img.width) {
    const W = img.width, H = img.height;
    const x0 = Math.floor((LON0 + 180) / 360 * W), x1 = Math.ceil((LON1 + 180) / 360 * W);
    const y0 = Math.floor((90 - LAT1) / 180 * H), y1 = Math.ceil((90 - LAT0) / 180 * H);
    const cw = x1 - x0, ch = y1 - y0;
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
    const px = g.getImageData(0, 0, cw, ch).data;
    cover = (lat, lon) => {
      const x = clamp(Math.round((lon + 180) / 360 * W) - x0, 0, cw - 1);
      const y = clamp(Math.round((90 - lat) / 180 * H) - y0, 0, ch - 1);
      return px[(y * cw + x) * 4] / 255;
    };
  }

  const r = rng(21), n = small ? 900 : 1600;
  const b = new PuffBatch(n, mat, 6);
  const p = new THREE.Vector3();
  b.begin();
  for (let tries = 0; b.n < n && tries < n * 30; tries++) {
    const lat = lerp(LAT0, LAT1, r()), lon = lerp(LON0, LON1, r());
    const c = sstep(0.32, 0.85, cover(lat, lon));
    if (r() > c) continue;                                   // cumulus only where the map has cloud
    latLonDir(lat, lon, p).multiplyScalar(1.0052 + c * 0.0016 + r() * 0.0007);
    const size = lerp(0.0032, 0.0095, c) * (0.75 + 0.5 * r());
    const variant = r() < 0.45 ? 2 : (r() < 0.5 ? 0 : 1);   // flat heaps and low domes, no round balls
    b.push(p.x, p.y, p.z, size, (r() - 0.5) * 0.35, variant, 0.92 + r() * 0.16, 0.22, lerp(0.35, 0.8, c), 1.6 + r() * 0.8);
  }
  b.end();
  space.dive = b;
  space.diveGroup.add(b.mesh);
}

/* -------------------------------- space contrail */
function buildSpaceTrail() {
  const mat = puffMaterial({ lit: '#ffffff', shade: '#8aa0c8', rim: '#dfe7f5' });
  space.trail = new PuffBatch(1100, mat, 7);
  space.trailP = [];
  space.earth.add(space.trail.mesh);
}

/* ================================================================== SKY */
const sky = { scene: new THREE.Scene() };
sky.cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 2500);
sky.D = 40;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = /* glsl */`
uniform vec3 uTop, uMid, uLow, uHaze, uSunCol, uSunDir;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = mix(uLow, uMid, smoothstep(-0.04, 0.2, y));
  c = mix(c, uTop, smoothstep(0.16, 0.7, y));
  c = mix(c, uHaze, smoothstep(0.05, -0.14, y));
  float n = sin(d.x * 3.1 + 0.7) * sin(d.y * 5.3 + 1.3) * 0.5 + 0.5;
  float m = sin(d.x * 7.7 - 1.1) * sin(d.y * 9.1 + d.x * 2.0) * 0.5 + 0.5;
  c *= 0.95 + 0.06 * n + 0.03 * m;
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  c += uSunCol * (pow(sd, 24.0) * 0.5 + pow(sd, 4.0) * 0.16);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

function skyMaterial(p) {
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uTop: { value: col(p.top) }, uMid: { value: col(p.mid) }, uLow: { value: col(p.low) }, uHaze: { value: col(p.haze) },
      uSunCol: { value: col(p.sun) }, uSunDir: { value: new THREE.Vector3(-0.55, 0.42, -0.72).normalize() },
    },
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false,
  });
}

function buildSky() {
  const p = palette(isDark());
  sky.pal = p;
  sky.domeMat = skyMaterial(p);
  sky.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), sky.domeMat);
  sky.dome.renderOrder = -10;
  sky.dome.frustumCulled = false;
  sky.scene.add(sky.dome);

  // lights for the airliner
  sky.sun = new THREE.DirectionalLight(0xfff4e8, 3.2);
  sky.sun.castShadow = true;
  sky.sun.shadow.mapSize.set(2048, 2048);
  sky.sun.shadow.bias = -0.0004;
  sky.sun.shadow.normalBias = 0.03;
  sky.scene.add(sky.sun, sky.sun.target);
  sky.hemi = new THREE.HemisphereLight(0xc4cff4, 0xeae4f6, 1.1);
  sky.scene.add(sky.hemi);

  // environment for reflections: the same sky, rendered into a PMREM
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial(p));
  envDome.material.depthTest = true;
  envScene.add(envDome);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: col(p.haze), side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.2;
  envScene.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  sky.env = pm.fromScene(envScene, 0.03).texture;
  pm.dispose();
  sky.scene.environment = sky.env;
  space.scene.environment = sky.env;
  space.scene.environmentIntensity = 0.35;

  buildCloudSea(p);
  sky.trailMat = puffMaterial({ lit: p.lit, shade: p.shade, rim: p.rim });
  sky.trail = new PuffBatch(1100, sky.trailMat, 3);
  sky.trailP = [];
  sky.scene.add(sky.trail.mesh);

  // speed streaks
  const sm = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aPos; attribute vec2 aS; varying vec2 vUv; varying float vA;
      void main(){ vUv = uv; vA = aS.y; vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
        mv.xy += position.xy * vec2(aS.x, aS.x * 0.012); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec2 vUv; varying float vA;
      void main(){ float a = sin(vUv.x * 3.1416) * pow(1.0 - abs(vUv.y * 2.0 - 1.0), 2.0) * vA * uOpacity;
        gl_FragColor = vec4(vec3(1.0) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const n = 46;
  const g = instancedQuad(n);
  sky.streakPos = new Float32Array(n * 3);
  sky.streakS = new Float32Array(n * 2);
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(sky.streakPos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aS', new THREE.InstancedBufferAttribute(sky.streakS, 2));
  const r = rng(77);
  sky.streaks = [];
  for (let i = 0; i < n; i++) sky.streaks.push({ x: r(), y: r() * 2 - 1, z: lerp(-14, 16, r()), v: 70 + r() * 90, len: 4 + r() * 9, a: 0.1 + r() * 0.3 });
  for (let i = 0; i < n; i++) sky.streakS.set([sky.streaks[i].len, sky.streaks[i].a], i * 2);
  sky.streakMat = sm;
  sky.streakMesh = new THREE.Mesh(g, sm);
  sky.streakMesh.frustumCulled = false;
  sky.streakMesh.renderOrder = 6;
  sky.scene.add(sky.streakMesh);
}

/** Cumulus sea below the flight level, wrapped around the camera by the shader. */
function buildCloudSea(p) {
  const r = rng(5);
  const n = small ? 240 : 420;
  const items = [];
  for (let i = 0; i < n; i++) {
    const z = -Math.pow(r(), 0.75) * 260 + 14;
    const depth = sky.D - z;
    const sz = lerp(7, 16, r()) * (0.55 + depth / 120);
    const yTop = -12.5 - depth * 0.014;
    const y = yTop - r() * sz * 0.35 - (r() < 0.15 ? sz * 0.4 : 0);
    const x = (r() - 0.5) * 400;
    items.push({ x, y, z, sz, rot: (r() - 0.5) * 0.5, v: Math.floor(r() * 3), b: 0.85 + r() * 0.3, ph: r() });
  }
  // a few towering cumulus far away, and wisps higher up
  for (let i = 0; i < 18 && items.length < n + 18; i++) {
    const z = lerp(-240, -120, r());
    items.push({ x: (r() - 0.5) * 400, y: lerp(-13, -5, r()), z, sz: lerp(20, 34, r()), rot: (r() - 0.5) * 0.4, v: r() < 0.5 ? 0 : 1, b: 0.9 + r() * 0.2, ph: r(), alpha: 0.5 });
  }
  items.sort((a, b) => a.z - b.z);
  const N = items.length;
  const gg = instancedQuad(N);
  const pos = new Float32Array(N * 3), d = new Float32Array(N * 4), e = new Float32Array(N * 4);
  items.forEach((it, i) => {
    pos.set([it.x, it.y, it.z], i * 3);
    d.set([it.sz, it.rot, it.v, it.b], i * 4);
    e.set([0.35, it.alpha ?? 1, 1.35, it.ph], i * 4);
  });
  gg.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  gg.setAttribute('aD', new THREE.InstancedBufferAttribute(d, 4));
  gg.setAttribute('aE', new THREE.InstancedBufferAttribute(e, 4));
  sky.seaMat = puffMaterial({ defines: { CLOUD: '' }, lit: p.lit, shade: p.shade, rim: p.rim, fog: p.fog, fogNear: 40, fogFar: 300, fogMax: 0.72 });
  sky.sea = new THREE.Mesh(gg, sky.seaMat);
  sky.sea.frustumCulled = false;
  sky.sea.renderOrder = 1;
  sky.scene.add(sky.sea);
}

/* -------------------------------- layout for the flight and the title */
function skyLayout() {
  const W = innerWidth, H = innerHeight;
  const viewH = 2 * sky.D * Math.tan((30 * D2R) / 2);   // the side-view lens, whatever the camera is doing now
  const viewW = viewH * (W / H);
  const k = clamp(viewW / 38, 0.3, 1.15);
  let cy = H * 0.36, sh = H * 0.5;
  if (ui.stage) {
    const r = ui.stage.getBoundingClientRect();
    cy = r.top + (window.scrollY || 0) + r.height / 2;
    sh = r.height;
  }
  const textY = (0.5 - cy / H) * viewH;
  const stageH = (sh / H) * viewH;
  return { W, H, viewH, viewW, k, textY, stageH, worldPerPx: viewH / H };
}

/* -------------------------------- the airliner's motion over the cloud sea */
function flightModel(L) {
  const k = L.k;
  const v = 14 * k, acc = 19 * k;
  const scale = 0.95 * k;
  const xFinal = 0;
  const xCamEnd = xFinal - 0.4 * v;               // camera position when level flight ends
  const offset = -0.08 * L.viewW;                 // plane sits a little left of centre while tracked
  const x0 = xCamEnd + offset - v * SKY_CRUISE;
  const y0 = L.textY;
  return {
    v, acc, scale, x0, y0, offset,
    camX(t) {
      if (t <= SKY_CRUISE) return x0 - offset + v * Math.max(t, 0);
      const u = Math.min(t - SKY_CRUISE, 0.8);
      return xCamEnd + v * (u - (u * u) / 1.6);   // linear deceleration to a stop in 0.8 s
    },
    plane(t, o) {
      const te = Math.max(0, t - SKY_CRUISE);
      const ex = sstep(0, 1.7, te);
      const tb = sstep(0.2, 1.4, t);                   // turbulence builds up after the hand-over
      o.x = x0 + v * t + 0.5 * acc * te * te;
      o.y = y0 + (Math.sin(t * 1.3) * 0.12 * k + Math.sin(t * 2.9 + 1) * 0.05 * k) * tb + ex * ex * 3.2 * k;
      o.z = ex * ex * 9 * k;
      o.pitch = (Math.sin(t * 1.1) * 0.012 + Math.sin(t * 17.0) * 0.0025) * tb + ex * 0.07;
      o.roll = (Math.sin(t * 1.7) * 0.025 + Math.sin(t * 13.3) * 0.004) * tb - ex * 0.06;
      o.yaw = Math.sin(t * 0.9) * 0.01 * tb - ex * 0.05;
      o.s = scale * (1 + ex * 0.15);
      return o;
    },
  };
}

/* -------------------------------- cloud title */
function rasterTitle(lines) {
  const c = document.createElement('canvas');
  const fs = 300, pad = 120, gap = 46, lineH = fs * 1.12;
  const x = c.getContext('2d', { willReadFrequently: true });
  const font = `700 ${fs}px "Fredoka", "Baloo 2", "Nunito", "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`;
  x.font = font;
  const rows = lines.map((text) => {
    const widths = [...text].map((ch) => x.measureText(ch).width);
    return { text, widths, w: widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1) };
  });
  c.width = Math.ceil(Math.max(...rows.map((r) => r.w)) + pad * 2);
  c.height = Math.ceil(lineH * lines.length + pad * 2);
  x.font = font;
  x.textBaseline = 'middle';
  x.fillStyle = '#fff';
  // a round stroke on top of the fill makes the strokes chunkier, like inflated cloud letters
  x.strokeStyle = 'rgba(0,0,0,0)';
  x.lineJoin = 'round';
  x.lineWidth = 0;   // no extra thickening: thinner strokes read better as clouds
  rows.forEach((row, li) => {
    let cx = (c.width - row.w) / 2;
    const cy = pad + lineH * (li + 0.5) + fs * 0.04;
    [...row.text].forEach((ch, i) => {
      x.fillText(ch, cx, cy);
      x.strokeText(ch, cx, cy);
      cx += row.widths[i] + gap;
    });
  });
  const img = x.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  const mask = new Uint8Array(W * H);
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let i = 0; i < W * H; i++) {
    if (img[i * 4 + 3] > 127) {
      mask[i] = 1;
      const px = i % W, py = (i / W) | 0;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
  }
  // chamfer distance to the outside (3-4 metric)
  const INF = 1e6, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 1; y < H - 1; y++) for (let xx = 1; xx < W - 1; xx++) {
    const i = y * W + xx;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], d[i - 1] + 3, d[i - W] + 3, d[i - W - 1] + 4, d[i - W + 1] + 4);
  }
  for (let y = H - 2; y > 0; y--) for (let xx = W - 2; xx > 0; xx--) {
    const i = y * W + xx;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], d[i + 1] + 3, d[i + W] + 3, d[i + W + 1] + 4, d[i + W - 1] + 4);
  }
  let dmax = 0;
  for (let i = 0; i < W * H; i++) { d[i] /= 3; if (d[i] > dmax) dmax = d[i]; }
  return { W, H, mask, d, dmax, x0, x1, y0, y1 };
}

function buildTitle(L, F) {
  const R = rasterTitle(['Samruk', 'Travel']);
  const r = rng(42);
  const aspect = (R.x1 - R.x0) / (R.y1 - R.y0);
  const textW = Math.min(L.viewW * (L.W < 600 ? 0.9 : 0.78), L.stageH * 0.84 * aspect, 46);
  const scale = textW / (R.x1 - R.x0);
  const cxPx = (R.x0 + R.x1) / 2, cyPx = (R.y0 + R.y1) / 2;
  const toW = (px, py) => [(px - cxPx) * scale, L.textY - (py - cyPx) * scale];
  const dAt = (x, y) => R.d[(y | 0) * R.W + (x | 0)];
  const grad = (x, y) => {
    x |= 0; y |= 0;
    return [dAt(x + 2, y) - dAt(x - 2, y), dAt(x, y + 2) - dAt(x, y - 2)];
  };
  const target = small ? 2600 : 4400;
  let area = 0;
  for (let i = 0; i < R.W * R.H; i++) area += R.mask[i];
  const sp = Math.sqrt(area / (target * 0.62 * 0.866));
  const P = [];
  // interior: hex grid with jitter
  for (let row = 0, y = R.y0; y <= R.y1; row++, y += sp * 0.866) {
    for (let x = R.x0 + ((row & 1) ? sp * 0.5 : 0); x <= R.x1; x += sp) {
      const px = x + (r() - 0.5) * sp * 0.7, py = y + (r() - 0.5) * sp * 0.7;
      if (px < 2 || py < 2 || px >= R.W - 2 || py >= R.H - 2) continue;
      const dd = dAt(px, py);
      if (dd <= 0) continue;
      P.push({ px, py, dn: dd / R.dmax, dl: dd, kind: 0 });
    }
  }
  // outline: lumpy small puffs pushed slightly outward
  const step = Math.max(2, Math.round(sp * 0.55));
  for (let y = R.y0; y <= R.y1; y += step) {
    for (let x = R.x0; x <= R.x1; x += step) {
      const px = x + (r() - 0.5) * step, py = y + (r() - 0.5) * step;
      const dd = dAt(px, py);
      if (dd <= 0 || dd > 2.2) continue;
      const [gx, gy] = grad(px, py);
      const gl = Math.hypot(gx, gy) || 1;
      const push = R.dmax * (r() * 0.04);
      P.push({ px: px - (gx / gl) * push, py: py - (gy / gl) * push, dn: 0, kind: 1, up: gy / gl });
    }
  }
  const items = [];
  const dmaxW = R.dmax * scale;
  for (const p of P) {
    const [wx, wy] = toW(p.px, p.py);
    let up = p.up;
    if (up === undefined) { const [gx, gy] = grad(p.px, p.py); const gl = Math.hypot(gx, gy) || 1; up = gy / gl; }
    const dn = p.dn;
    const size = p.kind
      ? dmaxW * lerp(0.3, 0.52, r())
      : clamp(2.3 * p.dl / R.dmax, 0.55, 1.5) * dmaxW * lerp(0.88, 1.12, r());
    const z = p.kind ? (r() - 0.5) * dmaxW * 0.6 : dn * dmaxW * lerp(0.4, 1.2, r());
    const bright = clamp(0.93 + 0.32 * up * (1 - dn) + 0.1 * dn + (r() - 0.5) * 0.14, 0.55, 1.3);
    const rim = (1 - dn) * (0.85 - 0.4 * up);
    const wisp = p.kind && up > 0.6 && r() < 0.09 ? 1 : 0;
    items.push({ x: wx + (r() - 0.5) * 0.02, y: wy, z, size, rot: r() * 6.28, v: Math.floor(r() * 4), bright, rim, wisp, seed: r() });
  }
  // plain smoke between and around the letters: part of the trail, it only drifts and fades
  if (F) {
    const x0 = toW(R.x0, 0)[0] - 3 * L.k, x1 = toW(R.x1, 0)[0] + 2 * L.k;
    for (let x = x0; x <= x1; x += 0.07 * L.k) {
      items.push({ x, y: 0, z: -0.5, size: dmaxW * lerp(0.45, 0.75, r()), rot: r() * 6.28, v: Math.floor(r() * 4), bright: 1.05, rim: 0.2, wisp: 2, seed: r() });
    }
  }
  items.sort((a, b) => a.z - b.z);

  // release along the smoke trail: tail of the airliner passing each x
  const trail = F ? trailTable(F) : null;
  const n = items.length;
  const g = instancedQuad(n);
  const aPos = new Float32Array(n * 3), aStart = new Float32Array(n * 3), aD = new Float32Array(n * 4), aE = new Float32Array(n * 4), aT = new Float32Array(n * 4);
  items.forEach((it, i) => {
    let rel = -100, sx = it.x, sy = it.y, sz = it.z;
    if (trail) {
      const tr = trail(it.x + (r() - 0.5) * 0.25);
      rel = tr.t;
      sx = it.x + (r() - 0.5) * 0.3 * L.k;
      sy = tr.y + (r() - 0.5) * 0.22 * L.k;
      sz = tr.z + (r() - 0.5) * 0.3 * L.k;
    }
    if (it.wisp === 2) { it.x = sx + (r() - 0.2) * 0.8 * L.k; it.y = sy + (r() - 0.35) * 0.7 * L.k; it.z = sz; }
    aPos.set([it.x, it.y, it.z], i * 3);
    aStart.set([sx, sy, sz], i * 3);
    aD.set([it.size, it.rot, it.v, it.bright], i * 4);
    aE.set([it.rim, 1, 1, 0], i * 4);
    aT.set([rel, 0.18 + r() * 0.2, it.seed, it.wisp], i * 4);
  });
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  g.setAttribute('aStart', new THREE.InstancedBufferAttribute(aStart, 3));
  g.setAttribute('aD', new THREE.InstancedBufferAttribute(aD, 4));
  g.setAttribute('aE', new THREE.InstancedBufferAttribute(aE, 4));
  g.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 4));
  const p = sky.pal;
  // 10% see-through so the letters read as cloud rather than cotton
  const m = puffMaterial({ defines: { TEXT: '' }, lit: p.tLit, shade: p.tShade, rim: p.tRim, opacity: 0.9 });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  // soft drop shadow: the same puffs in deep violet, offset down-right and behind the letters
  const sm = puffMaterial({ defines: { TEXT: '' }, lit: p.tDrop, shade: p.tDrop, rim: p.tDrop, opacity: 0.34 });
  sm.uniforms.uTime = m.uniforms.uTime;
  const drop = new THREE.Mesh(g, sm);
  drop.frustumCulled = false;
  drop.renderOrder = 3.5;
  drop.position.set(dmaxW * 0.35, -dmaxW * 0.5, -dmaxW * 2);
  drop.scale.setScalar(1.015);
  mesh.add(drop);
  mesh.userData.drop = sm;
  let last = -100;
  for (let i = 0; i < n; i++) if (aT[i * 4 + 3] < 1.5) last = Math.max(last, aT[i * 4] + aT[i * 4 + 1]);
  return { mesh, mat: m, lastRelease: last };
}

/** Maps a world x to the time the airliner's tail passes it, and where the smoke is. */
function trailTable(F) {
  const ts = [], xs = [], ys = [], zs = [];
  const o = {};
  for (let t = 0; t <= 7; t += 1 / 240) {
    F.plane(t, o);
    ts.push(t);
    xs.push(o.x - 5.0 * o.s);
    ys.push(o.y + 0.36 * o.s);
    zs.push(o.z);
  }
  return (x) => {
    let lo = 0, hi = xs.length - 1;
    if (x <= xs[0]) return { t: ts[0], y: ys[0], z: zs[0] };
    if (x >= xs[hi]) return { t: ts[hi], y: ys[hi], z: zs[hi] };
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m; else hi = m; }
    const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
    return { t: lerp(ts[lo], ts[hi], f), y: lerp(ys[lo], ys[hi], f), z: lerp(zs[lo], zs[hi], f) };
  };
}

/* ================================================================== AIRLINER */
let PLANE = null;
async function loadPlane() {
  const draco = new DRACOLoader(manager);
  draco.setDecoderPath(DRACO_PATH);
  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync(asset('airliner.glb'));
  draco.dispose();
  const proto = gltf.scene;
  proto.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    if (m && m.emissiveIntensity > 1) o.userData.light = o.name;
  });
  PLANE = proto;
}
function makePlane() {
  const p = PLANE.clone(true);
  const rig = { root: new THREE.Group(), fans: [], lights: [] };
  rig.root.add(p);
  p.traverse((o) => {
    if (/^Fan_/.test(o.name)) rig.fans.push(o);
    if (o.isMesh && /^(Beacon|Strobe|Nav)/.test(o.name)) { o.material = o.material.clone(); rig.lights.push(o); }
  });
  return rig;
}
function animatePlaneParts(rig, t, dt) {
  for (const f of rig.fans) f.rotation.x += dt * 38;
  for (const o of rig.lights) {
    let on = 1;
    if (/^Beacon/.test(o.name)) on = (t % 1.2) < 0.12 ? 1 : 0.05;
    if (/^Strobe/.test(o.name)) on = (t % 1.0) < 0.05 || ((t + 0.15) % 1.0) < 0.05 ? 1 : 0.02;
    if (/^Nav/.test(o.name)) on = 0.8;
    o.material.emissiveIntensity = 7 * on;
  }
}

/* ================================================================== state */
const S = {
  t: 0, last: 0, phase: 'load', skyBuilt: false, done: false, built: false,
  planeSpace: null, planeSky: null, layout: null, flight: null, title: null,
  scrollY: 0, needsRender: true,
};
let composer, bloom;

function buildSpaceComposer() {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(DPR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(space.scene, space.cam));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.45, 0.96);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

/* -------------------------------- space choreography */
const DM = clamp(Math.pow(1.35 / (innerWidth / innerHeight), 0.5), 1, 1.55);   // >1 on portrait screens
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), invM = new THREE.Matrix4();
const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0);

// camera: far close-up of the globe → just above Kazakhstan, looking north over it
const CAM_A_DIR = latLonDir(26, 64), CAM_A_R = 3.35 * DM;
const CAM_C_DIR = latLonDir(37, 67), CAM_C_R = 1 + 0.2 * DM;
const LOOK_C = latLonDir(48.6, 69);
const UP_C = CAM_C_DIR.clone();
/** Point on the dive path, e = 0 (globe close-up) … 1 (above Kazakhstan). Altitude moves in log
    space, the way an orbital zoom feels: fast while far, slowing down as the ground comes close. */
function divePos(e, out = new THREE.Vector3()) {
  out.copy(CAM_A_DIR).lerp(CAM_C_DIR, e).normalize();
  return out.multiplyScalar(1 + Math.exp(lerp(Math.log(CAM_A_R - 1), Math.log(CAM_C_R - 1), e)));
}
const easeSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));

// the chase pose, in airliner units (× its scale), shared by the space and sky scenes so the
// airliner stays pixel-identical while the background changes from Earth to sky
const CHASE = { off: new THREE.Vector3(-5.5, 2.0, 27), look: new THREE.Vector3(1.6, 0.2, 0), fov: 34 };
CHASE.off.multiplyScalar(clamp(1.45 / (innerWidth / innerHeight), 1, 2.8));   // stand further back on narrow screens

// departure: from Astana heading east (slightly toward the camera), climbing, then levelling off
const PL = (() => {
  const A = ASTANA.clone();
  const east = latLonDir(51.17, 71.93).sub(A);
  east.addScaledVector(A, -east.dot(A)).normalize();
  const south = Y_AXIS.clone().addScaledVector(A, -A.y).normalize().negate();
  const head = east.multiplyScalar(Math.cos(14 * D2R)).addScaledVector(south, Math.sin(14 * D2R)).normalize();
  return { A, axis: A.clone().cross(head).normalize() };
})();
function planeSpacePos(t, out) {
  const tp = Math.max(0, t - T.planeStart);
  const g = 0.012 * tp + 0.043 * (tp - 0.6 * (1 - Math.exp(-tp / 0.6)));    // rolls, then speeds up
  const h = 0.0045 + 0.064 * (1 - Math.exp(-(tp / 1.4) * (tp / 1.4)));       // climbs, then levels off
  return out.copy(PL.A).applyAxisAngle(PL.axis, g).multiplyScalar(1.0015 + KZ_H + h);
}
const PS = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(), s: 0, q: new THREE.Quaternion() };
function planeSpacePose(t) {
  planeSpacePos(t, PS.pos);
  planeSpacePos(t + 0.02, PS.fwd).sub(PS.pos).normalize();
  PS.up.copy(PS.pos).normalize();
  PS.right.copy(PS.fwd).cross(PS.up).normalize();
  PS.up.copy(PS.right).cross(PS.fwd).normalize();
  tmpM.makeBasis(PS.fwd, PS.up, PS.right);
  PS.q.setFromRotationMatrix(tmpM);
  PS.s = lerp(0.0028, 0.0145, sstep(0, 3.0, t - T.planeStart));
  return PS;
}

const camPos0 = new THREE.Vector3(), camLook0 = new THREE.Vector3(), camUp0 = new THREE.Vector3();
const chasePos = new THREE.Vector3(), chaseLook = new THREE.Vector3();
function updateSpace(t, dt) {
  const cam = space.cam;
  // Earth turns slowly under the camera and comes to rest by the end of the approach
  const spin = clamp(t / T.diveEnd, 0, 1);
  space.earth.rotation.y = -22 * D2R * Math.pow(1 - spin, 1.5);

  // approach: the camera is already drifting toward the globe, then one long, even push-in
  // that ends a couple of hundred km above Kazakhstan. No zoom-lens tricks: the field of view
  // only widens a little near the ground, the way a wide lens shows more of the horizon.
  const dv = clamp((t - 0.2) / (T.diveEnd - 0.2), 0, 1);
  const de = easeSine(dv);
  divePos(de, camPos0);
  camPos0.multiplyScalar(1 - 0.012 * sstep(T.diveEnd - 0.4, T.diveEnd + 3, t));   // keeps gliding down
  camLook0.set(0, 0, 0).lerp(LOOK_C, easeSine(sstep(1.4, T.diveEnd, t)));
  camUp0.copy(Y_AXIS).lerp(UP_C, de).normalize();
  let fov = lerp(40, 52, sstep(0.45, 1.0, de));

  // airliner pose (Earth-local; the globe has stopped turning by take-off)
  const pose = planeSpacePose(t);
  const flying = t > T.planeStart;

  // follow the take-off, then swing in beside the airliner
  if (flying) camLook0.lerp(pose.pos, 0.25 * sstep(T.planeStart, T.chase, t));
  const b = easeInOut(sstep(T.chase, T.chaseEnd, t));
  if (b > 0) {
    chasePos.copy(CHASE.off).multiplyScalar(pose.s).applyQuaternion(pose.q).add(pose.pos);
    chaseLook.copy(CHASE.look).multiplyScalar(pose.s).applyQuaternion(pose.q).add(pose.pos);
    camPos0.lerp(chasePos, b);
    camLook0.lerp(chaseLook, b);
    camUp0.lerp(pose.up, b).normalize();
    fov = lerp(fov, CHASE.fov, b);
  }
  cam.position.copy(camPos0);
  cam.up.copy(camUp0);
  cam.lookAt(camLook0);
  cam.fov = fov;
  cam.updateProjectionMatrix();

  // shaders
  space.earth.updateMatrixWorld(true);
  const inv = invM.copy(space.earth.matrixWorld).invert();
  const sunL = SUN_WORLD.clone().transformDirection(inv);
  space.earthMat.uniforms.uSun.value.copy(sunL);
  space.earthMat.uniforms.uCam.value.copy(cam.position).applyMatrix4(inv);
  space.earthMat.uniforms.uCloudShift.value = t * 0.0025;
  space.cloudMat.uniforms.uSun.value.copy(sunL);
  space.cloudMat.uniforms.uCloudShift.value = t * 0.0025;
  space.stars.material.uniforms.uTime.value = t;
  space.atmoMat.uniforms.uCamW.value.copy(cam.position);

  // low cumulus over Central Asia: they ride with the cloud map and grow in as the ground comes close
  const alt = cam.position.length() - 1;
  space.diveGroup.rotation.y = -space.cloudMat.uniforms.uCloudShift.value * Math.PI * 2;
  space.diveMat.uniforms.uOpacity.value = sstep(0.85, 0.42, alt) * (1 - sstep(T.kzIn - 0.2, T.kzIn + 0.5, t));
  space.diveMat.uniforms.uLight.value.copy(SUN_WORLD).transformDirection(cam.matrixWorldInverse);

  // Kazakhstan
  const rise = backOut(clamp((t - T.kzRise) / (T.kzRiseEnd - T.kzRise), 0, 1));
  space.kzMat.uniforms.uAlpha.value = sstep(T.kzIn, T.kzIn + 0.5, t);
  space.kzMat.uniforms.uRise.value = rise;
  space.kzMat.uniforms.uTime.value = t;
  space.kzMat.uniforms.uSun.value.copy(sunL);
  space.curtainMat.uniforms.uBase.value = 1.0015 + KZ_H * rise;
  space.curtainMat.uniforms.uHc.value = 0.008 + 0.016 * sstep(T.kzRise, T.kzRiseEnd + 0.4, t);
  space.curtainMat.uniforms.uAmt.value = sstep(T.kzRise, T.kzRiseEnd, t) * (0.26 + 0.1 * Math.sin(t * 3.2)) * (1 - 0.6 * b);
  bloom.strength = 0.3 + 0.14 * sstep(T.kzRise, T.kzRiseEnd, t) * (1 - b);

  // dot and rings
  const ds = backOut(clamp((t - T.dot) / 0.45, 0, 1), 2.2);
  space.dot.scale.setScalar(Math.max(1e-4, ds * 0.7));
  space.rings.forEach((m, i) => {
    const ph = ((t - T.dot) * 0.8 + i * 0.5) % 1;
    m.scale.setScalar(0.008 + ph * 0.035);
    m.material.opacity = (1 - ph) * 0.85 * sstep(T.dot, T.dot + 0.3, t) * (1 - b);
  });

  // departure tag
  if (ui.tag) {
    ui.tag.classList.toggle('on', t > T.tagIn && t < T.tagOut);
    const p = tmpV2.copy(space.dot.position);
    space.earth.localToWorld(p);
    p.project(cam);
    const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
    ui.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  // the airliner
  const rig = S.planeSpace;
  if (rig) {
    rig.root.visible = flying;
    if (flying) {
      const tp = t - T.planeStart;
      rig.root.position.copy(pose.pos);
      rig.root.quaternion.copy(pose.q).multiply(tmpQ.setFromAxisAngle(X_AXIS, Math.sin(tp * 1.3) * 0.12 * Math.exp(-tp / 2) * (1 - b)));
      const grow = sstep(0, 0.35, tp);
      rig.root.scale.setScalar(Math.max(pose.s * grow, 1e-5));
      animatePlaneParts(rig, t, dt);
      // light the airliner the way the sky scene will, as the camera closes in
      space.planeSun.position.copy(SUN_WORLD).multiplyScalar(10);
      if (b > 0) {
        tmpV.set(-30, 40, 32).normalize().applyQuaternion(pose.q);
        space.planeSun.position.lerp(tmpV.multiplyScalar(10), b);
      }
      space.planeSun.position.add(pose.pos);
      space.planeSun.target.position.copy(pose.pos);
      space.hemi.position.copy(pose.up);
      space.hemi.color.lerpColors(space.hemiA[0], space.hemiB[0], b);
      space.hemi.groundColor.lerpColors(space.hemiA[1], space.hemiB[1], b);
      space.hemi.intensity = lerp(0.6, 1.1, b);
      space.scene.environmentIntensity = lerp(0.35, 1.0, b);
      if (grow > 0.5 && dt > 0) {
        rig.root.updateMatrixWorld(true);
        emitTrail(rig, space.trailP, t, dt, pose.s * grow);
      }
    }
  }
  drawTrail(space.trail, space.trailP, t, 1);
  space.trail.mat.uniforms.uLight.value.copy(SUN_WORLD).transformDirection(cam.matrixWorldInverse);
}

/* -------------------------------- contrails, shared by both scenes */
// engine exhausts and wingtips, in airliner space
const EMITTERS = [[-1.25, -0.62, 1.55, 0], [-1.25, -0.62, -1.55, 0], [-1.5, 0.72, 4.85, 1], [-1.5, 0.72, -4.85, 1]];
function emitTrail(rig, list, now, dt, s) {
  // interpolate between frames so the trail stays continuous at any frame rate
  const steps = Math.max(1, Math.round(dt * 120));
  rig.prev = rig.prev || {};
  EMITTERS.forEach(([lx, ly, lz, kind], j) => {
    const w = new THREE.Vector3(lx, ly, lz).applyMatrix4(rig.root.matrixWorld);
    const pv = rig.prev[j] || w;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      list.push({ x: lerp(pv.x, w.x, f), y: lerp(pv.y, w.y, f), z: lerp(pv.z, w.z, f), b: now - dt * (1 - f), kind, s, r: Math.random() });
    }
    rig.prev[j] = w;
  });
  if (list.length > 1050) list.splice(0, list.length - 1050);
}
function drawTrail(batch, list, now, fade) {
  for (let i = list.length - 1; i >= 0; i--) if (now - list[i].b > (list[i].kind ? 0.55 : 2.2)) list.splice(i, 1);
  batch.begin();
  for (const q of list) {
    const life = q.kind ? 0.55 : 2.2;
    const a = clamp((now - q.b) / life, 0, 1);
    if (q.kind) {
      batch.push(q.x, q.y, q.z, q.s * (0.16 + a * 0.3), 0, (q.r * 4) | 0, 1.05, 0.2, 0.32 * (1 - a), 3.2);
    } else {
      batch.push(q.x, q.y, q.z, q.s * (0.32 + a * 2.2), q.r * 6.28, (q.r * 4) | 0, 1.0, 0.25, 0.55 * Math.pow(1 - a, 1.4) * Math.min(1, (now - q.b) * 12) * fade, 1.6 - a * 0.5);
    }
  }
  batch.end();
}

/* -------------------------------- sky choreography */
const PO = {};
function setupSkyFlight() {
  S.layout = skyLayout();
  S.flight = flightModel(S.layout);
  if (!S.title) {
    S.title = buildTitle(S.layout, S.flight);
    sky.scene.add(S.title.mesh);
  }
  if (PLANE && !S.planeSky) {
    S.planeSky = makePlane();
    sky.scene.add(S.planeSky.root);
  }
}

const skyChasePos = new THREE.Vector3(), skyChaseLook = new THREE.Vector3(), skyLook = new THREE.Vector3();
function updateSky(tau, dt) {
  const L = S.layout, F = S.flight, cam = sky.cam;
  const cx = F.camX(tau);
  const shake = (1 - sstep(SKY_CRUISE, SKY_CRUISE + 0.8, tau)) * L.k * sstep(1.2, 2.2, tau);
  cam.position.set(cx + Math.sin(tau * 23) * 0.015 * shake, Math.sin(tau * 17 + 2) * 0.02 * shake - S.scrollY * L.worldPerPx, sky.D);
  // stop sinking once the title is out of view: the cards then sit over the cloud tops
  cam.position.y = Math.max(cam.position.y, -L.viewH * 0.85);
  skyLook.set(cam.position.x, cam.position.y, 0);
  // the intro hands over in the chase pose, then the camera swings out to the side view
  const kb = S.planeSky ? 1 - easeInOut(sstep(0.45, 2.1, tau)) : 0;
  if (kb > 0) {
    const o = F.plane(tau, PO);
    skyChasePos.copy(CHASE.off).multiplyScalar(o.s).add(tmpV.set(o.x, o.y, o.z));
    skyChaseLook.copy(CHASE.look).multiplyScalar(o.s).add(tmpV);
    cam.position.lerp(skyChasePos, kb);
    skyLook.lerp(skyChaseLook, kb);
  }
  cam.fov = lerp(30, CHASE.fov, kb);
  cam.updateProjectionMatrix();
  cam.lookAt(skyLook);
  sky.dome.position.copy(cam.position);

  // clouds
  sky.seaMat.uniforms.uTime.value = tau;
  sky.seaMat.uniforms.uCam.value.copy(cam.position);
  sky.seaMat.uniforms.uViewW.value = L.viewW;
  sky.seaMat.uniforms.uDist.value = sky.D;
  sky.seaMat.uniforms.uWind.value = -0.6;
  if (S.title) S.title.mat.uniforms.uTime.value = tau;

  // airliner
  const rig = S.planeSky;
  if (rig) {
    const o = F.plane(tau, PO);
    rig.root.visible = o.x - cam.position.x < L.viewW * 0.5 + 14 * o.s && tau < 9;
    rig.root.position.set(o.x, o.y, o.z);
    rig.root.rotation.set(o.roll, o.yaw, o.pitch, 'XYZ');
    rig.root.scale.setScalar(o.s);
    animatePlaneParts(rig, tau, dt);
    // shadow frustum follows the plane
    sky.sun.position.set(o.x - 30, o.y + 40, o.z + 32);
    sky.sun.target.position.set(o.x, o.y, o.z);
    const sc = sky.sun.shadow.camera;
    const h = 7 * o.s;
    sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.near = 1; sc.far = 120;
    sc.updateProjectionMatrix();

    // contrails and wingtip vortices
    if (rig.root.visible && dt > 0) {
      rig.root.updateMatrixWorld(true);
      emitTrail(rig, sky.trailP, tau, dt, o.s);
    }
  }
  drawTrail(sky.trail, sky.trailP, tau, 1 - 0.65 * sstep(SKY_CRUISE - 0.3, SKY_CRUISE + 0.4, tau));

  // speed streaks during level flight
  const sOn = sstep(0.8, 1.6, tau) * (1 - sstep(SKY_CRUISE - 0.2, SKY_CRUISE + 0.5, tau));
  sky.streakMat.uniforms.uOpacity.value = sOn;
  sky.streakMesh.visible = sOn > 0;
  if (sOn > 0) {
    const W = L.viewW * 1.6;
    sky.streaks.forEach((s, i) => {
      const x = cam.position.x + (((s.x * W - tau * s.v) % W) + W) % W - W / 2;
      sky.streakPos.set([x, cam.position.y + s.y * L.viewH * 0.55, s.z], i * 3);
    });
    sky.streakMesh.geometry.attributes.aPos.needsUpdate = true;
  }
}

/* ================================================================== main loop */
// full-screen quad that lays the finished space frame over the sky while they cross-fade
const fade = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
fade.mat = new THREE.ShaderMaterial({
  uniforms: { tMap: { value: null }, uAlpha: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform sampler2D tMap; uniform float uAlpha; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tMap, vUv).rgb, uAlpha); }',
  transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
});
fade.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fade.mat));

function blending() { return S.t < T.blendEnd && composer && !space.disposed; }

function render() {
  const t = S.t;
  if (S.phase === 'space') {
    composer.renderToScreen = true;
    composer.render();
  } else if (S.phase === 'sky' || S.phase === 'done') {
    if (blending()) {
      composer.renderToScreen = false;
      composer.render();
      renderer.setRenderTarget(null);
      renderer.render(sky.scene, sky.cam);
      fade.mat.uniforms.tMap.value = composer.readBuffer.texture;
      fade.mat.uniforms.uAlpha.value = 1 - easeInOut(sstep(T.swap, T.blendEnd, t));
      renderer.autoClear = false;
      renderer.render(fade.scene, fade.cam);
      renderer.autoClear = true;
    } else {
      renderer.render(sky.scene, sky.cam);
    }
  }
}

function step(dt) {
  const t = S.t;
  if (S.phase === 'space') {
    updateSpace(t, dt);
    if (t >= T.swap) toSky();
  } else if (blending()) {
    updateSpace(t, dt);
  }
  if (S.phase === 'sky' || S.phase === 'done') {
    const tau = t - T.swap;
    updateSky(tau, dt);
    if (S.phase === 'sky') {
      if (t > T.blendEnd + 0.3 && !space.disposed) disposeSpace();
      const revealAt = Math.max(SKY_CRUISE + 1.1, S.title.lastRelease + 0.55);
      if (tau > revealAt && !root.classList.contains('intro-done')) finishPage();
      if (tau > revealAt + MORPH + 0.4) S.phase = 'done';
    }
  }
}

function toSky() {
  S.phase = 'sky';
  if (!S.skyBuilt) { buildSky(); S.skyBuilt = true; }
  setupSkyFlight();
  if (ui.tag) ui.tag.classList.remove('on');
  // pre-roll the contrail so it matches the one behind the airliner in the space scene
  if (S.planeSky) {
    S.planeSky.prev = null;
    for (let tau = -1.6; tau < 0; tau += 1 / 60) updateSky(tau, 1 / 60);
  }
}

/** Free the globe's textures and meshes once the sky has taken over. */
function disposeSpace() {
  if (space.disposed || !space.tex) return;
  space.disposed = true;
  if (S.planeSpace) space.earth.remove(S.planeSpace.root);   // shares geometry with the sky airliner
  for (const v of Object.values(space.tex)) v.dispose();
  space.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material !== space.trail?.mat && o.material !== space.diveMat) o.material.dispose();
  });
  if (composer) composer.dispose();
}

let rafId = 0, running = false;
function start() { if (!running) { running = true; S.last = 0; rafId = requestAnimationFrame(loop); } }
function loop(now) {
  rafId = requestAnimationFrame(loop);
  const dt = S.last ? Math.min((now - S.last) / 1000, 1 / 20) : 1 / 60;
  S.last = now;
  if (document.hidden) return;
  const titleVisible = S.phase !== 'done' || S.scrollY < (S.layout ? S.layout.H * 1.1 : 1e9);
  if (!titleVisible && !S.needsRender) return;
  S.t += dt;
  S.needsRender = false;
  step(dt);
  render();
}

/* ================================================================== page reveal + controls */
function finishPage() {
  root.classList.remove('intro-pending', 'intro-playing');
  root.classList.add('intro-done');
  if (ui.skip) ui.skip.hidden = true;
  if (ui.load) ui.load.hidden = true;
  if (ui.tag) ui.tag.classList.remove('on');
}

function skipToEnd() {
  if (S.phase === 'done') return;
  if (!S.skyBuilt) { buildSky(); S.skyBuilt = true; }
  if (S.title) { sky.scene.remove(S.title.mesh); S.title.mesh.geometry.dispose(); }
  S.layout = skyLayout();
  S.flight = flightModel(S.layout);
  S.title = buildTitle(S.layout, null);
  sky.scene.add(S.title.mesh);
  S.phase = 'done';
  S.t = T.swap + 30;
  sky.trailP = [];
  if (S.planeSky) { sky.scene.remove(S.planeSky.root); S.planeSky = null; }
  if (ui.tag) ui.tag.classList.remove('on');
  finishPage();
  disposeSpace();
  S.needsRender = true;
  start();
}

function onScroll() {
  S.scrollY = window.scrollY || 0;
  S.needsRender = true;
  if (reduceMotion && S.phase === 'done') { step(0); render(); }
}

let resizeT = 0;
function onResize() {
  renderer.setSize(innerWidth, innerHeight, false);
  space.cam.aspect = sky.cam.aspect = innerWidth / innerHeight;
  space.cam.updateProjectionMatrix();
  sky.cam.updateProjectionMatrix();
  if (composer) composer.setSize(innerWidth, innerHeight);
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (S.phase !== 'done' || !S.title) { S.needsRender = true; return; }
    // rebuild the title for the new layout, already formed
    sky.scene.remove(S.title.mesh);
    S.title.mesh.geometry.dispose();
    S.title.mat.dispose();
    S.layout = skyLayout();
    S.flight = flightModel(S.layout);
    S.title = buildTitle(S.layout, null);
    sky.scene.add(S.title.mesh);
    S.needsRender = true;
    if (reduceMotion) { step(0); render(); }
  }, 180);
}

function retheme() {
  if (!S.skyBuilt) return;
  const p = palette(isDark());
  sky.pal = p;
  const u = sky.domeMat.uniforms;
  u.uTop.value.set(p.top); u.uMid.value.set(p.mid); u.uLow.value.set(p.low); u.uHaze.value.set(p.haze); u.uSunCol.value.set(p.sun);
  for (const m of [sky.seaMat, sky.trailMat]) { m.uniforms.uLit.value.set(p.lit); m.uniforms.uShade.value.set(p.shade); m.uniforms.uRim.value.set(p.rim); m.uniforms.uFog.value.set(p.fog); }
  if (S.title) { const m = S.title.mat.uniforms; m.uLit.value.set(p.tLit); m.uShade.value.set(p.tShade); m.uRim.value.set(p.tRim); const d = S.title.mesh.userData.drop; if (d) for (const k of ['uLit', 'uShade', 'uRim']) d.uniforms[k].value.set(p.tDrop); }
  S.needsRender = true;
  if (reduceMotion) { step(0); render(); }
}

/* ================================================================== boot */
async function boot() {
  addEventListener('resize', onResize);
  addEventListener('scroll', onScroll, { passive: true });
  darkMQ.addEventListener?.('change', retheme);

  if (!wantIntro) {
    await fontReady;
    buildSky();
    S.skyBuilt = true;
    S.layout = skyLayout();
    S.flight = flightModel(S.layout);
    S.title = buildTitle(S.layout, null);
    sky.scene.add(S.title.mesh);
    S.phase = 'done';
    S.t = T.swap + 30;
    finishPage();
    S.scrollY = window.scrollY || 0;
    if (reduceMotion) { step(0); render(); return; }
    start();
    return;
  }

  root.classList.remove('intro-pending');
  root.classList.add('intro-playing');
  if (ui.skip) {
    ui.skip.hidden = false;
    ui.skip.addEventListener('click', skipToEnd);
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape') skipToEnd(); });
  window.scrollTo(0, 0);

  const big = !small && Math.max(innerWidth, innerHeight) * DPR > 1000;
  let tex;
  try {
    const [day, night, water, bump, clouds] = await Promise.all([
      loadTex(big ? 'earth-day.jpg' : 'earth-day-2k.jpg', true),
      loadTex('earth-night.jpg'), loadTex('earth-water.jpg'), loadTex('earth-bump.jpg'), loadTex('earth-clouds.jpg'),
      loadPlane(), fontReady,
    ]);
    tex = { day, night, water, bump, clouds };
  } catch (e) {
    console.warn('[intro] assets failed, showing the sky only', e);
    skipToEnd();
    return;
  }
  if (S.phase === 'done') { for (const v of Object.values(tex || {})) v.dispose(); return; }   // skipped while loading
  space.tex = tex;

  buildStars();
  buildEarth(tex);
  buildKazakhstan(tex.day);
  buildDiveClouds(tex.clouds);
  buildSpaceTrail();
  buildSpaceComposer();
  S.planeSpace = makePlane();
  space.earth.add(S.planeSpace.root);
  S.planeSpace.root.visible = false;
  // light the departing airliner like the Earth below it
  space.planeSun = new THREE.DirectionalLight(0xfff2e0, 3.0);
  space.planeSun.position.copy(SUN_WORLD).multiplyScalar(10);
  space.scene.add(space.planeSun, space.planeSun.target);
  space.hemiA = [new THREE.Color(0x9cc0ff), new THREE.Color(0x10203a)];
  space.hemiB = [new THREE.Color(0xc4cff4), new THREE.Color(0xeae4f6)];
  space.hemi = new THREE.HemisphereLight(0x9cc0ff, 0x10203a, 0.6);
  space.scene.add(space.hemi);
  // build the sky, flight and title now so the swap does not stall a frame
  if (!S.skyBuilt) { buildSky(); S.skyBuilt = true; }
  setupSkyFlight();
  renderer.compile(space.scene, space.cam);
  renderer.compile(sky.scene, sky.cam);

  if (ui.load) ui.load.hidden = true;
  S.phase = 'space';
  S.t = 0;
  start();
}

/* debug hook for screenshots: __samrukIntro.seek(seconds) */
window.__samrukIntro = {
  seek(t) {
    cancelAnimationFrame(rafId);
    running = false;
    const target = t;
    if (S.phase === 'load') return false;
    if (target < T.swap && S.phase !== 'space') return false;
    // step forward in fixed increments so trails and state evolve as in real time
    while (S.t < target) {
      const dt = Math.min(1 / 30, target - S.t);
      S.t += dt;
      step(dt);
    }
    render();
    return true;
  },
  get state() { return { t: S.t, phase: S.phase }; },  skip: skipToEnd,
};

boot().catch(fail);
