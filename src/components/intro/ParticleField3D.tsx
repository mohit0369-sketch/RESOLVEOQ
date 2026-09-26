import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  generateClusterTarget,
  generateInvestigationTarget,
  generateMaskBrainTarget,
  generateMaskBulbTarget,
  generateRecommendationTarget,
  generateResolutionTarget,
  generateScatterTarget,
  ParticleTarget,
} from './particleTargets3D';

interface Props {
  progress: number;
}

type SceneKey = 'brain' | 'scatter' | 'clusters' | 'bulb' | 'investigation' | 'recommendation' | 'resolution';

type SceneConfig = {
  start: number;
  end: number;
  shape: SceneKey;
  x: number;
  y: number;
  scale: number;
  rotX: number;
  rotY: number;
  z: number;
};

const SCENES: SceneConfig[] = [
  { start: 0, end: 1 / 7, shape: 'brain', x: 2.05, y: -0.02, scale: 1.34, rotX: -0.03, rotY: 0.06, z: 0.0 },
  { start: 1 / 7, end: 2 / 7, shape: 'scatter', x: 0.15, y: 0.02, scale: 1.0, rotX: 0.0, rotY: 0.26, z: 0.35 },
  { start: 2 / 7, end: 3 / 7, shape: 'clusters', x: 1.35, y: 0.0, scale: 1.18, rotX: -0.05, rotY: 0.18, z: 0.15 },
  { start: 3 / 7, end: 4 / 7, shape: 'bulb', x: -1.78, y: -0.05, scale: 1.22, rotX: -0.02, rotY: -0.16, z: 0.05 },
  { start: 4 / 7, end: 5 / 7, shape: 'investigation', x: 1.85, y: 0.0, scale: 0.94, rotX: 0.08, rotY: 0.2, z: -0.2 },
  { start: 5 / 7, end: 6 / 7, shape: 'recommendation', x: -1.8, y: 0.0, scale: 1.0, rotX: -0.04, rotY: -0.2, z: 0.0 },
  { start: 6 / 7, end: 1, shape: 'resolution', x: 1.95, y: 0.0, scale: 0.92, rotX: 0.0, rotY: 0.14, z: -0.1 },
];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const t = clamp01(n);
  return t * t * (3 - 2 * t);
};

function makeTriangleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.moveTo(size / 2, size * 0.1);
  ctx.lineTo(size * 0.9, size * 0.86);
  ctx.lineTo(size * 0.1, size * 0.86);
  ctx.closePath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.14;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function getScenePair(progress: number) {
  const clamped = clamp01(progress);
  const scaled = clamped * (SCENES.length - 1);
  const index = Math.min(SCENES.length - 2, Math.floor(scaled));
  const local = smooth(scaled - index);
  return { a: SCENES[index], b: SCENES[index + 1], t: local };
}

function byShape(targets: Record<SceneKey, ParticleTarget>, key: SceneKey) {
  return targets[key];
}

export const ParticleField3D: React.FC<Props> = ({ progress }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    const mobile = window.innerWidth < 900;
    const count = mobile ? 2000 : 4200;
    const ambientCount = mobile ? 260 : 520;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 10.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const triangleTexture = makeTriangleTexture();

    const group = new THREE.Group();
    scene.add(group);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: mobile ? 0.14 : 0.12,
      map: triangleTexture,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true,
      opacity: 1.0,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });

    const points = new THREE.Points(geometry, material);
    group.add(points);

    const targets: Partial<Record<SceneKey, ParticleTarget>> = {
      scatter: generateScatterTarget(count),
      clusters: generateClusterTarget(count),
      investigation: generateInvestigationTarget(count),
      recommendation: generateRecommendationTarget(count),
      resolution: generateResolutionTarget(count),
    };

    // Start from deterministic scatter immediately, then replace the two mask-based targets when loaded.
    targets.brain = generateScatterTarget(count, 111);
    targets.bulb = generateScatterTarget(count, 222);

    const current = new Float32Array(targets.scatter!.positions);
    const activeTarget = new Float32Array(targets.scatter!.positions);
    positions.set(current);
    colors.set(targets.scatter!.colors);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    void Promise.all([
      generateMaskBrainTarget('/assets/brain-mask.png', count),
      generateMaskBulbTarget('/assets/bulb-mask.png', count),
    ]).then(([brain, bulb]) => {
      if (cancelled) return;
      targets.brain = brain;
      targets.bulb = bulb;
    }).catch(() => {
      // Keep the deterministic visible scatter fallback; never blank the renderer.
    });

    const ambientGeo = new THREE.BufferGeometry();
    const ambientPos = new Float32Array(ambientCount * 3);
    const ambientColor = new Float32Array(ambientCount * 3);
    const ambientSeed = new Float32Array(ambientCount);
    let seed = 999;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < ambientCount; i++) {
      ambientPos[i * 3] = (rand() - 0.5) * 10;
      ambientPos[i * 3 + 1] = (rand() - 0.5) * 6.8;
      ambientPos[i * 3 + 2] = (rand() - 0.5) * 5.2;
      ambientSeed[i] = rand() * 100;
      const roll = rand();
      const c = roll < 0.32 ? new THREE.Color('#9a6cff') : roll < 0.54 ? new THREE.Color('#ffc233') : roll < 0.74 ? new THREE.Color('#18b892') : roll < 0.86 ? new THREE.Color('#d457ff') : roll < 0.94 ? new THREE.Color('#5f8cff') : new THREE.Color('#ffffff');
      ambientColor[i * 3] = c.r;
      ambientColor[i * 3 + 1] = c.g;
      ambientColor[i * 3 + 2] = c.b;
    }

    ambientGeo.setAttribute('position', new THREE.BufferAttribute(ambientPos, 3));
    ambientGeo.setAttribute('color', new THREE.BufferAttribute(ambientColor, 3));
    const ambientMat = new THREE.PointsMaterial({
      size: mobile ? 0.052 : 0.046,
      map: triangleTexture,
      transparent: true,
      alphaTest: 0.08,
      vertexColors: true,
      opacity: 0.62,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });
    const ambient = new THREE.Points(ambientGeo, ambientMat);
    scene.add(ambient);

    const morphStrength = 0.085;
    const inertia = 0.79;
    const shapeScale = mobile ? 0.92 : 1.0;

    const resolveTarget = (key: SceneKey): ParticleTarget => {
      const target = targets[key];
      if (target) return target;
      return targets.scatter!;
    };

    function animate(now: number) {
      if (cancelled) return;

      const p = clamp01(progressRef.current);
      const pair = getScenePair(p);
      const targetA = byShape(targets as Record<SceneKey, ParticleTarget>, pair.a.shape);
      const targetB = byShape(targets as Record<SceneKey, ParticleTarget>, pair.b.shape);
      const actualA = targetA || resolveTarget(pair.a.shape);
      const actualB = targetB || resolveTarget(pair.b.shape);

      const targetX = pair.a.x + (pair.b.x - pair.a.x) * pair.t;
      const targetY = pair.a.y + (pair.b.y - pair.a.y) * pair.t;
      const targetScale = pair.a.scale + (pair.b.scale - pair.a.scale) * pair.t;
      const targetRotX = pair.a.rotX + (pair.b.rotX - pair.a.rotX) * pair.t;
      const targetRotY = pair.a.rotY + (pair.b.rotY - pair.a.rotY) * pair.t;
      const targetZ = pair.a.z + (pair.b.z - pair.a.z) * pair.t;

      group.position.x += ((targetX - group.position.x) * 0.08);
      group.position.y += ((targetY - group.position.y) * 0.08);
      group.position.z += ((targetZ - group.position.z) * 0.08);
      group.scale.setScalar(shapeScale * (1.02 + targetScale * 0.20));
      group.rotation.x += ((targetRotX - group.rotation.x) * 0.06);
      group.rotation.y += ((targetRotY + Math.sin(now * 0.00025) * 0.025 - group.rotation.y) * 0.06);

      for (let i = 0; i < count; i++) {
        const base = i * 3;
        const ax = actualA.positions[base];
        const ay = actualA.positions[base + 1];
        const az = actualA.positions[base + 2];
        const bx = actualB.positions[base];
        const by = actualB.positions[base + 1];
        const bz = actualB.positions[base + 2];

        activeTarget[base] = ax + (bx - ax) * pair.t;
        activeTarget[base + 1] = ay + (by - ay) * pair.t;
        activeTarget[base + 2] = az + (bz - az) * pair.t;

        const dx = activeTarget[base] - positions[base];
        const dy = activeTarget[base + 1] - positions[base + 1];
        const dz = activeTarget[base + 2] - positions[base + 2];

        velocity[base] = velocity[base] * inertia + dx * morphStrength;
        velocity[base + 1] = velocity[base + 1] * inertia + dy * morphStrength;
        velocity[base + 2] = velocity[base + 2] * inertia + dz * morphStrength;

        positions[base] += velocity[base];
        positions[base + 1] += velocity[base + 1];
        positions[base + 2] += velocity[base + 2];

        // Very small breathing motion, independent of scroll direction.
        const phase = i * 0.37;
        positions[base] += Math.sin(now * 0.0008 + phase) * 0.0008;
        positions[base + 1] += Math.cos(now * 0.0007 + phase * 1.1) * 0.0008;
      }

      // Ambient field drifts in real 3D space.
      const ap = ambientGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < ambientCount; i++) {
        const base = i * 3;
        const s = ambientSeed[i];
        ap[base] += Math.sin(now * 0.00008 + s) * 0.00022;
        ap[base + 1] += Math.cos(now * 0.0001 + s * 1.3) * 0.00018;
        ap[base + 2] += Math.sin(now * 0.00006 + s * 0.7) * 0.00015;
        if (ap[base] > 5.3) ap[base] = -5.3;
        if (ap[base] < -5.3) ap[base] = 5.3;
        if (ap[base + 1] > 3.5) ap[base + 1] = -3.5;
        if (ap[base + 1] < -3.5) ap[base + 1] = 3.5;
        if (ap[base + 2] > 2.7) ap[base + 2] = -2.7;
        if (ap[base + 2] < -2.7) ap[base + 2] = 2.7;
      }

      geometry.attributes.position.needsUpdate = true;
      ambientGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    const onResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', onResize, { passive: true });
    requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      geometry.dispose();
      material.dispose();
      ambientGeo.dispose();
      ambientMat.dispose();
      triangleTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
};
