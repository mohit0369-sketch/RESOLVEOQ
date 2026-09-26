import * as THREE from 'three';

export type ParticleTarget = {
  positions: Float32Array;
  colors: Float32Array;
};

const PALETTE = {
  white: new THREE.Color('#ffffff'),
  violet: new THREE.Color('#9a6cff'),
  violetBright: new THREE.Color('#b18aff'),
  amber: new THREE.Color('#ffc233'),
  amberBright: new THREE.Color('#ffd45a'),
  teal: new THREE.Color('#18b892'),
  tealBright: new THREE.Color('#35d6b1'),
  magenta: new THREE.Color('#d457ff'),
  blue: new THREE.Color('#5f8cff'),
};

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function setColor(colors: Float32Array, index: number, c: THREE.Color) {
  colors[index * 3] = c.r;
  colors[index * 3 + 1] = c.g;
  colors[index * 3 + 2] = c.b;
}

function makeTarget(count: number) {
  return {
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
  };
}

function pointOnSphere(rand: () => number) {
  const theta = rand() * Math.PI * 2;
  const u = rand() * 2 - 1;
  const s = Math.sqrt(Math.max(0, 1 - u * u));
  return [Math.cos(theta) * s, u, Math.sin(theta) * s] as const;
}

/**
 * Create a volumetric brain using the supplied brain silhouette as an XY
 * constraint. The silhouette is not rendered; it only supplies the shape.
 */
export async function generateMaskBrainTarget(
  src: string,
  count: number,
  seed = 101,
): Promise<ParticleTarget> {
  const mask = await loadMask(src);
  const rand = seeded(seed);
  const out = makeTarget(count);

  const usable = mask.points.length > 0 ? mask.points : fallbackBrain2D(2400, seed);
  const size = 3.15;

  for (let i = 0; i < count; i++) {
    // Randomized sampling avoids visible point-row repetition while preserving the mask silhouette.
    const sample = usable[Math.floor(rand() * usable.length)];

    // Give the silhouette real volume: deeper through the middle, slightly thinner toward the rim.
    const radial = Math.min(1, Math.hypot(sample.x * 0.9, sample.y));
    const depth = 1.18 * (0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - radial * radial)));
    let z = (rand() - 0.5) * depth * 1.8;

    // Layer a few gentle cortical ridges in depth so it reads as a living volume, not a stamped plane.
    const fold = Math.sin(sample.y * 18 + sample.x * 11) * Math.cos(sample.x * 9 - sample.y * 5);
    z += fold * 0.06;

    // Very small XY deformation keeps the contour organic without destroying the recognizable mask.
    const n = 0.045 * Math.sin(sample.x * 16 + sample.y * 11 + i * 0.013);
    const x = sample.x * size + n;
    const y = sample.y * size * 0.98 + n * 0.35;

    out.positions[i * 3] = x;
    out.positions[i * 3 + 1] = y;
    out.positions[i * 3 + 2] = z;

    // Favor vivid chromatic particles. White is an accent, never the dominant color.
    const roll = rand();
    let c = PALETTE.violet;
    if (roll < 0.30) c = PALETTE.violet;
    else if (roll < 0.46) c = PALETTE.amber;
    else if (roll < 0.62) c = PALETTE.teal;
    else if (roll < 0.74) c = PALETTE.magenta;
    else if (roll < 0.84) c = PALETTE.blue;
    else if (roll < 0.93) c = PALETTE.violetBright;
    else c = PALETTE.white;
    setColor(out.colors, i, c);
  }

  return out;
}

/** Scatter remains a 3D cloud rather than a flat field. */
export function generateScatterTarget(count: number, seed = 202): ParticleTarget {
  const rand = seeded(seed);
  const out = makeTarget(count);
  for (let i = 0; i < count; i++) {
    const dir = pointOnSphere(rand);
    const radius = 2.0 + Math.pow(rand(), 0.55) * 3.7;
    out.positions[i * 3] = dir[0] * radius * 1.28;
    out.positions[i * 3 + 1] = dir[1] * radius * 0.78;
    out.positions[i * 3 + 2] = dir[2] * radius * 0.72;

    const roll = rand();
    const c = roll < 0.34 ? PALETTE.violet : roll < 0.58 ? PALETTE.amber : roll < 0.78 ? PALETTE.teal : roll < 0.9 ? PALETTE.magenta : PALETTE.white;
    setColor(out.colors, i, c);
  }
  return out;
}

/** Four semantic clusters with distinct depth positions. */
export function generateClusterTarget(count: number, seed = 303): ParticleTarget {
  const rand = seeded(seed);
  const out = makeTarget(count);
  const centers = [
    [-1.65, 0.95, 0.45, PALETTE.amber],
    [1.5, 0.85, -0.35, PALETTE.violet],
    [-1.45, -0.95, -0.35, PALETTE.teal],
    [1.55, -0.9, 0.5, PALETTE.white],
  ] as const;

  for (let i = 0; i < count; i++) {
    if (i < count * 0.86) {
      const h = centers[i % centers.length];
      const dir = pointOnSphere(rand);
      const radius = 0.18 + Math.pow(rand(), 0.7) * 0.72;
      out.positions[i * 3] = h[0] + dir[0] * radius;
      out.positions[i * 3 + 1] = h[1] + dir[1] * radius * 0.82;
      out.positions[i * 3 + 2] = h[2] + dir[2] * radius * 0.92;
      setColor(out.colors, i, rand() > 0.08 ? h[3] : PALETTE.white);
    } else {
      const a = centers[i % centers.length];
      const b = centers[(i + 1) % centers.length];
      const t = rand();
      out.positions[i * 3] = a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * 0.1;
      out.positions[i * 3 + 1] = a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 0.1;
      out.positions[i * 3 + 2] = a[2] + (b[2] - a[2]) * t + (rand() - 0.5) * 0.1;
      setColor(out.colors, i, t < 0.5 ? a[3] : b[3]);
    }
  }

  return out;
}

/**
 * Volumetric bulb sampled from the supplied silhouette. The interior of the
 * bulb contains extra filament particles to make the form read immediately.
 */
export async function generateMaskBulbTarget(
  src: string,
  count: number,
  seed = 404,
): Promise<ParticleTarget> {
  const mask = await loadMask(src);
  const rand = seeded(seed);
  const out = makeTarget(count);
  const usable = mask.points.length > 0 ? mask.points : fallbackBulb2D(1800, seed);
  const size = 2.85;

  for (let i = 0; i < count; i++) {
    const p = usable[Math.floor(rand() * usable.length)];
    const depth = 0.82 * (0.5 + 0.5 * Math.sqrt(rand()));
    const z = (rand() - 0.5) * depth * 1.45;
    out.positions[i * 3] = p.x * size;
    out.positions[i * 3 + 1] = p.y * size;
    out.positions[i * 3 + 2] = z;

    const yNorm = p.y;
    let c = PALETTE.amber;
    if (Math.abs(yNorm) < 0.32 && rand() > 0.74) c = PALETTE.white;
    else if (yNorm > 0.42) c = rand() > 0.55 ? PALETTE.amber : PALETTE.violet;
    else if (yNorm < -0.38) c = rand() > 0.5 ? PALETTE.violet : PALETTE.teal;
    setColor(out.colors, i, c);
  }

  return out;
}

export function generateInvestigationTarget(count: number, seed = 505): ParticleTarget {
  const rand = seeded(seed);
  const out = makeTarget(count);
  const nodes = [
    [-1.7, 1.2, 0.8, PALETTE.violet],
    [0.0, 1.65, -0.45, PALETTE.teal],
    [1.7, 1.0, 0.5, PALETTE.teal],
    [-0.8, 0.0, -0.6, PALETTE.white],
    [0.9, -0.2, 0.7, PALETTE.teal],
    [-1.4, -1.35, 0.35, PALETTE.violet],
    [1.35, -1.45, -0.35, PALETTE.amber],
  ] as const;
  const edges = [
    [0, 1], [1, 2], [0, 3], [1, 3], [2, 4], [3, 4], [3, 5], [4, 6], [5, 6],
  ] as const;

  const nodeCount = Math.floor(count * 0.56);
  for (let i = 0; i < count; i++) {
    if (i < nodeCount) {
      const n = nodes[i % nodes.length];
      const dir = pointOnSphere(rand);
      const r = 0.08 + Math.pow(rand(), 0.72) * 0.34;
      out.positions[i * 3] = n[0] + dir[0] * r;
      out.positions[i * 3 + 1] = n[1] + dir[1] * r;
      out.positions[i * 3 + 2] = n[2] + dir[2] * r;
      setColor(out.colors, i, rand() > 0.28 ? n[3] : PALETTE.white);
    } else {
      const edge = edges[(i - nodeCount) % edges.length];
      const a = nodes[edge[0]];
      const b = nodes[edge[1]];
      const t = rand();
      out.positions[i * 3] = a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * 0.06;
      out.positions[i * 3 + 1] = a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 0.06;
      out.positions[i * 3 + 2] = a[2] + (b[2] - a[2]) * t + (rand() - 0.5) * 0.08;
      setColor(out.colors, i, t < 0.5 ? a[3] : b[3]);
    }
  }

  return out;
}

export function generateRecommendationTarget(count: number, seed = 606): ParticleTarget {
  const rand = seeded(seed);
  const out = makeTarget(count);
  for (let i = 0; i < count; i++) {
    const t = rand();
    const side = rand() > 0.5 ? -1 : 1;
    const depth = (rand() - 0.5) * 0.6;
    const x = (t - 0.48) * 3.45;
    const y = side * (1 - t) * 1.7;
    out.positions[i * 3] = x + (rand() - 0.5) * 0.09;
    out.positions[i * 3 + 1] = y + (rand() - 0.5) * 0.09;
    out.positions[i * 3 + 2] = depth;
    setColor(out.colors, i, t > 0.72 ? PALETTE.amber : t > 0.45 ? PALETTE.white : PALETTE.violet);
  }
  return out;
}

export function generateResolutionTarget(count: number, seed = 707): ParticleTarget {
  const rand = seeded(seed);
  const out = makeTarget(count);
  const radii = [0.42, 0.9, 1.42, 1.95, 2.4];
  for (let i = 0; i < count; i++) {
    const ring = radii[i % radii.length];
    const a = rand() * Math.PI * 2;
    const r = ring + (rand() - 0.5) * 0.06;
    out.positions[i * 3] = Math.cos(a) * r;
    out.positions[i * 3 + 1] = Math.sin(a) * r * 0.8;
    out.positions[i * 3 + 2] = (rand() - 0.5) * 0.55;
    const c = i % radii.length === 4 ? PALETTE.violet : i % radii.length === 3 ? PALETTE.teal : i % radii.length === 2 ? PALETTE.white : PALETTE.amber;
    setColor(out.colors, i, c);
  }
  return out;
}

export async function loadMask(src: string): Promise<{ points: { x: number; y: number }[] }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });

  const size = 220;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * (image.height / image.width));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const points: { x: number; y: number }[] = [];

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      const alpha = pixels[index + 3];
      const brightness = pixels[index] + pixels[index + 1] + pixels[index + 2];
      if (alpha > 20 && brightness > 120) {
        points.push({
          x: (x / (canvas.width - 1) - 0.5) * 2,
          y: -((y / (canvas.height - 1) - 0.5) * 2),
        });
      }
    }
  }
  if (!points.length) throw new Error(`Mask ${src} contains no usable pixels`);
  return { points };
}

function fallbackBrain2D(count: number, seed: number) {
  const rand = seeded(seed);
  const points: { x: number; y: number }[] = [];
  while (points.length < count) {
    const x = rand() * 2 - 1;
    const y = rand() * 2 - 1;
    const left = Math.pow((x + 0.32) / 0.72, 2) + Math.pow(y / 0.88, 2) < 1;
    const right = Math.pow((x - 0.32) / 0.72, 2) + Math.pow(y / 0.88, 2) < 1;
    const lower = Math.pow(x / 0.28, 2) + Math.pow((y + 0.95) / 0.32, 2) < 1;
    if (left || right || lower) points.push({ x, y });
  }
  return points;
}

function fallbackBulb2D(count: number, seed: number) {
  const rand = seeded(seed);
  const points: { x: number; y: number }[] = [];
  while (points.length < count) {
    const x = rand() * 2 - 1;
    const y = rand() * 2 - 1.2;
    const body = Math.pow(x / 0.78, 2) + Math.pow((y - 0.15) / 0.92, 2) < 1;
    const neck = Math.abs(x) < 0.28 && y < -0.55 && y > -1.15;
    const base = Math.abs(x) < 0.34 && y <= -1.02;
    if (body || neck || base) points.push({ x, y });
  }
  return points;
}
