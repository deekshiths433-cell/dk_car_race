import * as THREE from 'three';
import { BIOME_PALETTES } from '../data/tracks';
import { LevelConfig, QualityLevel } from '../types/game';
import {
  getAsphaltTexture,
  getCheckeredStripTexture,
  getGroundTexture,
  getStartFinishTexture,
} from './textures';

export interface TrackSample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  s: number; // 0..totalLength
}

export interface TrackObstacle {
  position: THREE.Vector3;
  radius: number;
  mesh: THREE.Object3D;
  hitCooldown: number;
}

export interface CheckpointGate {
  index: number; // 0..N-1
  sampleIndex: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  mesh: THREE.Group;
}

export interface BuiltTrack {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  totalLength: number;
  roadHalfWidth: number;
  barrierHalfWidth: number;
  obstacles: TrackObstacle[];
  checkpoints: CheckpointGate[];
  minimapPoints: Array<{ x: number; y: number }>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  dispose: () => void;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildProceduralTrack(
  config: LevelConfig,
  quality: QualityLevel,
  maxAnisotropy: number,
  seed: number = Date.now()
): BuiltTrack {
  const rng = mulberry32(seed + config.level * 997);
  const group = new THREE.Group();
  const palette = BIOME_PALETTES[config.biome];
  const isWet = config.weather === 'rain' || config.biome === 'neon_night';

  const roadHalfWidth = 8.2; // 16.4m wide supercar road
  const barrierHalfWidth = 11.6;

  // 1. Generate closed non-self-intersecting control points around an irregular star-loop
  const controlCount = 16 + Math.min(8, Math.floor(config.level / 2) * 2);
  const baseRadius = config.trackLengthMeters / (2 * Math.PI);
  const controlPoints: THREE.Vector3[] = [];

  for (let i = 0; i < controlCount; i++) {
    const angle = (i / controlCount) * Math.PI * 2;
    // Keep start/finish straight (near i=0,1,controlCount-1) smooth & flat
    const isStartZone = i <= 1 || i >= controlCount - 1;
    const radialJitter = isStartZone
      ? 0
      : (rng() - 0.5) * 2 * (0.28 + config.turnTightness * 0.24);
    const wave =
      Math.sin(angle * 3 + config.level) * (0.14 + config.turnTightness * 0.14) +
      Math.cos(angle * 2 - config.level * 0.7) * 0.1;
    const r = baseRadius * (1 + radialJitter + (isStartZone ? 0 : wave));

    const elev =
      isStartZone || config.biome === 'coastal' || config.biome === 'city'
        ? 0
        : (Math.sin(angle * 2 + 0.5) * 4.5 + Math.cos(angle * 4) * 2.2) *
          (config.biome === 'mountain' ? 1.5 : 0.75);

    controlPoints.push(
      new THREE.Vector3(Math.cos(angle) * r, Math.max(0, elev), Math.sin(angle) * r)
    );
  }

  const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);
  const totalLength = curve.getLength();
  const sampleCount = 420;
  const samples: TrackSample[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < sampleCount; i++) {
    const u = i / sampleCount;
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    samples.push({
      point,
      tangent,
      right,
      s: u * totalLength,
    });
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  // Normalized minimap polyline (0..1)
  const pad = 25;
  const spanX = Math.max(1, maxX - minX + pad * 2);
  const spanZ = Math.max(1, maxZ - minZ + pad * 2);
  const span = Math.max(spanX, spanZ);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const minimapPoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < sampleCount; i += 4) {
    const p = samples[i].point;
    minimapPoints.push({
      x: 0.5 + (p.x - cx) / span,
      y: 0.5 + (p.z - cz) / span,
    });
  }

  // 2. Ground / Terrain Plane extending far to horizon (natural perimeter)
  const terrainSize = Math.max(1800, span * 2.8);
  const groundTex = getGroundTexture(config.biome, maxAnisotropy);
  const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: config.biome === 'snow' ? 0.65 : 0.92,
    metalness: 0.02,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.set(cx, -0.08, cz);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // Coastal ocean shimmer plane outside the coastal track
  if (config.biome === 'coastal') {
    const seaGeo = new THREE.PlaneGeometry(terrainSize, terrainSize);
    seaGeo.rotateX(-Math.PI / 2);
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.16,
      metalness: 0.65,
    });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.position.set(cx + terrainSize * 0.28, -0.04, cz);
    group.add(sea);
  }

  // 3. Road Ribbon Geometry + Shoulder Curbs
  const roadPos: number[] = [];
  const roadUvs: number[] = [];
  const roadIdx: number[] = [];

  const curbPos: number[] = [];
  const curbColors: number[] = [];
  const curbIdx: number[] = [];

  const cA = new THREE.Color(palette.curbA);
  const cB = new THREE.Color(palette.curbB);

  for (let i = 0; i <= sampleCount; i++) {
    const smp = samples[i % sampleCount];
    const p = smp.point;
    const r = smp.right;
    const vCoord = (i / sampleCount) * (totalLength / 14);

    // Road vertices (left, right)
    const lx = p.x - r.x * roadHalfWidth;
    const ly = p.y + 0.04;
    const lz = p.z - r.z * roadHalfWidth;

    const rx = p.x + r.x * roadHalfWidth;
    const ry = p.y + 0.04;
    const rz = p.z + r.z * roadHalfWidth;

    roadPos.push(lx, ly, lz, rx, ry, rz);
    roadUvs.push(0, vCoord, 1, vCoord);

    // Left & right curbs (1.1m wide)
    const curbOuter = roadHalfWidth + 1.15;
    const clx = p.x - r.x * curbOuter;
    const clz = p.z - r.z * curbOuter;
    const crx = p.x + r.x * curbOuter;
    const crz = p.z + r.z * curbOuter;

    curbPos.push(
      clx, ly + 0.02, clz,
      lx, ly + 0.02, lz,
      rx, ry + 0.02, rz,
      crx, ry + 0.02, crz
    );
    const col = i % 2 === 0 ? cA : cB;
    for (let k = 0; k < 4; k++) {
      curbColors.push(col.r, col.g, col.b);
    }

    if (i < sampleCount) {
      const b = i * 2;
      roadIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);

      const cb = i * 4;
      // Left curb quad
      curbIdx.push(cb, cb + 1, cb + 4, cb + 1, cb + 5, cb + 4);
      // Right curb quad
      curbIdx.push(cb + 2, cb + 3, cb + 6, cb + 3, cb + 7, cb + 6);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIdx);
  roadGeo.computeVertexNormals();

  const asphaltTex = getAsphaltTexture(config.biome, isWet, maxAnisotropy);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: isWet ? 0.24 : 0.78,
    metalness: isWet ? 0.35 : 0.06,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
  curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
  curbGeo.setIndex(curbIdx);
  curbGeo.computeVertexNormals();
  const curbMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    metalness: 0.05,
  });
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.receiveShadow = true;
  group.add(curbMesh);

  // 4. Start / Finish Line & Overhead Gantry (at sample 0)
  const startSmp = samples[0];
  const startGroup = new THREE.Group();
  startGroup.position.copy(startSmp.point);
  const startAngle = Math.atan2(-startSmp.tangent.x, -startSmp.tangent.z);
  startGroup.rotation.y = startAngle;

  const stripMat = new THREE.MeshBasicMaterial({
    map: getCheckeredStripTexture(maxAnisotropy),
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const stripMesh = new THREE.Mesh(new THREE.PlaneGeometry(roadHalfWidth * 2, 3.2), stripMat);
  stripMesh.rotation.x = -Math.PI / 2;
  stripMesh.position.y = 0.07;
  startGroup.add(stripMesh);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
  const pillarGeo = new THREE.BoxGeometry(0.9, 7.2, 0.9);
  const pL = new THREE.Mesh(pillarGeo, pillarMat);
  pL.position.set(-roadHalfWidth - 1.4, 3.6, 0);
  const pR = new THREE.Mesh(pillarGeo, pillarMat);
  pR.position.set(roadHalfWidth + 1.4, 3.6, 0);
  startGroup.add(pL, pR);

  const bannerMat = new THREE.MeshStandardMaterial({
    map: getStartFinishTexture(maxAnisotropy),
    emissive: 0xffffff,
    emissiveMap: getStartFinishTexture(maxAnisotropy),
    emissiveIntensity: config.timeOfDay === 'night' ? 0.85 : 0.25,
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(roadHalfWidth * 2 + 3.4, 2.2, 0.7), bannerMat);
  banner.position.set(0, 6.4, 0);
  startGroup.add(banner);
  group.add(startGroup);

  // 5. Checkpoints (4 sequential gates around circuit)
  const checkpoints: CheckpointGate[] = [];
  const cpFractions = [0.22, 0.48, 0.74, 0.94];
  const cpMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.65,
  });

  cpFractions.forEach((frac, idx) => {
    const sIdx = Math.floor(frac * sampleCount);
    const smp = samples[sIdx];
    const cpGroup = new THREE.Group();
    cpGroup.position.copy(smp.point);
    cpGroup.rotation.y = Math.atan2(-smp.tangent.x, -smp.tangent.z);

    const archPostGeo = new THREE.BoxGeometry(0.35, 5.2, 0.35);
    const aL = new THREE.Mesh(archPostGeo, cpMat);
    aL.position.set(-roadHalfWidth - 0.6, 2.6, 0);
    const aR = new THREE.Mesh(archPostGeo, cpMat);
    aR.position.set(roadHalfWidth + 0.6, 2.6, 0);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(roadHalfWidth * 2 + 1.5, 0.35, 0.35), cpMat);
    topBar.position.set(0, 5.2, 0);
    cpGroup.add(aL, aR, topBar);
    group.add(cpGroup);

    checkpoints.push({
      index: idx,
      sampleIndex: sIdx,
      position: smp.point.clone(),
      tangent: smp.tangent.clone(),
      mesh: cpGroup,
    });
  });

  // 6. Instanced Roadside Guardrail Posts (Performance: single InstancedMesh)
  const postStep = quality === 'low' ? 6 : 4;
  const postPositions: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < sampleCount; i += postStep) {
    const smp = samples[i];
    const yaw = Math.atan2(-smp.tangent.x, -smp.tangent.z);
    for (const side of [-1, 1]) {
      dummy.position.set(
        smp.point.x + smp.right.x * (barrierHalfWidth * side),
        smp.point.y + 0.45,
        smp.point.z + smp.right.z * (barrierHalfWidth * side)
      );
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postPositions.push(dummy.matrix.clone());
    }
  }

  const postGeo = new THREE.BoxGeometry(0.35, 0.9, 2.6);
  const postMat = new THREE.MeshStandardMaterial({
    color: config.biome === 'neon_night' ? 0x1e293b : 0x94a3b8,
    emissive: config.biome === 'neon_night' ? 0x06b6d4 : 0x000000,
    emissiveIntensity: config.biome === 'neon_night' ? 0.35 : 0,
    metalness: 0.55,
    roughness: 0.4,
  });
  const postsInstanced = new THREE.InstancedMesh(postGeo, postMat, postPositions.length);
  postPositions.forEach((m, idx) => postsInstanced.setMatrixAt(idx, m));
  postsInstanced.instanceMatrix.needsUpdate = true;
  postsInstanced.computeBoundingSphere();
  group.add(postsInstanced);

  // 7. Procedural Obstacles on Road (Cones / Chicane Barriers scaling with difficulty)
  const obstacles: TrackObstacle[] = [];
  const obstacleCount = Math.floor(config.obstacleDensity * 16);
  const coneGeo = new THREE.ConeGeometry(0.42, 0.95, 10);
  const coneMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.25,
    roughness: 0.4,
  });
  const barrierGeo = new THREE.BoxGeometry(2.2, 0.85, 0.65);
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });

  for (let i = 0; i < obstacleCount; i++) {
    // Keep start zone clear
    const sIdx = Math.floor(25 + (i / Math.max(1, obstacleCount)) * (sampleCount - 45));
    const smp = samples[sIdx];
    const lateralOffset = (rng() > 0.5 ? 1 : -1) * (2.6 + rng() * 3.8);
    const pos = smp.point.clone().addScaledVector(smp.right, lateralOffset);
    pos.y += 0.45;

    const isBarrier = i % 3 === 0 && config.level >= 2;
    const mesh = new THREE.Mesh(isBarrier ? barrierGeo : coneGeo, isBarrier ? barrierMat : coneMat);
    mesh.position.copy(pos);
    mesh.rotation.y = Math.atan2(-smp.tangent.x, -smp.tangent.z);
    mesh.castShadow = quality !== 'low';
    group.add(mesh);

    obstacles.push({
      position: pos,
      radius: isBarrier ? 1.25 : 0.6,
      mesh,
      hitCooldown: 0,
    });
  }

  // 8. Instanced Biome Scenery (Trees, Buildings, Mesas, Lamps)
  buildBiomeScenery(group, samples, config, quality, rng, cx, cz, span);

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mt) => mt.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
  };

  return {
    group,
    curve,
    samples,
    totalLength,
    roadHalfWidth,
    barrierHalfWidth,
    obstacles,
    checkpoints,
    minimapPoints,
    bounds: { minX, maxX, minZ, maxZ },
    dispose,
  };
}

function buildBiomeScenery(
  group: THREE.Group,
  samples: TrackSample[],
  config: LevelConfig,
  quality: QualityLevel,
  rng: () => number,
  cx: number,
  cz: number,
  span: number
) {
  const count = quality === 'high' ? 180 : quality === 'medium' ? 120 : 65;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Helper to verify a world point isn't on the road
  const isClearOfRoad = (x: number, z: number, minDist: number) => {
    for (let i = 0; i < samples.length; i += 4) {
      const p = samples[i].point;
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < minDist * minDist) return false;
    }
    return true;
  };

  if (config.biome === 'city' || config.biome === 'neon_night') {
    // Instanced Skyscraper Towers + Glowing Windows/Trim
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    const isNeon = config.biome === 'neon_night';
    const towerMat = new THREE.MeshStandardMaterial({
      color: isNeon ? 0x0f172a : 0x475569,
      emissive: isNeon ? 0x082f49 : 0x000000,
      emissiveIntensity: isNeon ? 0.55 : 0,
      roughness: 0.4,
      metalness: 0.65,
    });
    const inst = new THREE.InstancedMesh(towerGeo, towerMat, count);
    let placed = 0;
    for (let attempt = 0; attempt < count * 5 && placed < count; attempt++) {
      const smp = samples[Math.floor(rng() * samples.length)];
      const side = rng() > 0.5 ? 1 : -1;
      const dist = 20 + rng() * 55;
      const x = smp.point.x + smp.right.x * side * dist;
      const z = smp.point.z + smp.right.z * side * dist;
      if (!isClearOfRoad(x, z, 16)) continue;

      const w = 8 + rng() * 14;
      const h = 18 + rng() * 62;
      const d = 8 + rng() * 14;
      dummy.position.set(x, h / 2 - 0.1, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);

      if (isNeon) {
        const neonPalette = [0x06b6d4, 0xec4899, 0x8b5cf6, 0xf59e0b];
        color.setHex(neonPalette[placed % neonPalette.length]).multiplyScalar(0.45);
      } else {
        const shade = 0.35 + rng() * 0.35;
        color.setRGB(shade, shade + 0.04, shade + 0.08);
      }
      inst.setColorAt(placed, color);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  } else if (config.biome === 'desert') {
    // Sandstone Mesas & Desert Cacti
    const mesaGeo = new THREE.CylinderGeometry(0.65, 1.0, 1, 7);
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 });
    const mesaCount = Math.floor(count * 0.45);
    const mesaInst = new THREE.InstancedMesh(mesaGeo, mesaMat, mesaCount);
    let placed = 0;
    for (let attempt = 0; attempt < mesaCount * 5 && placed < mesaCount; attempt++) {
      const x = cx + (rng() - 0.5) * span * 1.45;
      const z = cz + (rng() - 0.5) * span * 1.45;
      if (!isClearOfRoad(x, z, 22)) continue;
      const s = 10 + rng() * 22;
      const h = 8 + rng() * 24;
      dummy.position.set(x, h / 2 - 0.2, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(s, h, s);
      dummy.updateMatrix();
      mesaInst.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesaInst.count = placed;
    mesaInst.instanceMatrix.needsUpdate = true;
    mesaInst.computeBoundingSphere();
    group.add(mesaInst);

    // Cacti
    const cactusGeo = new THREE.CylinderGeometry(0.28, 0.32, 3.8, 8);
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.8 });
    const cactusInst = new THREE.InstancedMesh(cactusGeo, cactusMat, count);
    let cPlaced = 0;
    for (let attempt = 0; attempt < count * 5 && cPlaced < count; attempt++) {
      const smp = samples[Math.floor(rng() * samples.length)];
      const side = rng() > 0.5 ? 1 : -1;
      const dist = 15 + rng() * 45;
      const x = smp.point.x + smp.right.x * side * dist;
      const z = smp.point.z + smp.right.z * side * dist;
      if (!isClearOfRoad(x, z, 14)) continue;
      const sc = 0.75 + rng() * 0.7;
      dummy.position.set(x, 1.8 * sc, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      cactusInst.setMatrixAt(cPlaced, dummy.matrix);
      cPlaced++;
    }
    cactusInst.count = cPlaced;
    cactusInst.instanceMatrix.needsUpdate = true;
    cactusInst.computeBoundingSphere();
    group.add(cactusInst);
  } else {
    // Pine / Palm / Snowy Trees (2 instanced layers: trunks + foliage cones)
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.38, 3.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const crownGeo =
      config.biome === 'coastal'
        ? new THREE.ConeGeometry(2.6, 2.2, 7)
        : new THREE.ConeGeometry(2.2, 7.2, 7);
    const crownColor =
      config.biome === 'snow' ? 0xdbeafe : config.biome === 'coastal' ? 0x16a34a : 0x166534;
    const crownMat = new THREE.MeshStandardMaterial({ color: crownColor, roughness: 0.85 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);

    let placed = 0;
    for (let attempt = 0; attempt < count * 5 && placed < count; attempt++) {
      const smp = samples[Math.floor(rng() * samples.length)];
      const side = rng() > 0.5 ? 1 : -1;
      const dist = 15 + rng() * 55;
      const x = smp.point.x + smp.right.x * side * dist;
      const z = smp.point.z + smp.right.z * side * dist;
      if (!isClearOfRoad(x, z, 14)) continue;

      const sc = 0.8 + rng() * 0.75;
      dummy.position.set(x, smp.point.y + 1.5 * sc, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(x, smp.point.y + (config.biome === 'coastal' ? 3.5 : 5.2) * sc, z);
      dummy.updateMatrix();
      crowns.setMatrixAt(placed, dummy.matrix);

      color.setHex(crownColor).offsetHSL(0, 0, (rng() - 0.5) * 0.12);
      crowns.setColorAt(placed, color);
      placed++;
    }
    trunks.count = placed;
    crowns.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    group.add(trunks, crowns);
  }

  // Streetlamps along track at night or city/neon biomes
  if (config.timeOfDay === 'night' || config.biome === 'city' || config.biome === 'neon_night') {
    const lampStep = 14;
    const lampPositions: THREE.Matrix4[] = [];
    for (let i = 0; i < samples.length; i += lampStep) {
      const smp = samples[i];
      const side = (i / lampStep) % 2 === 0 ? 1 : -1;
      dummy.position.set(
        smp.point.x + smp.right.x * (10.5 * side),
        smp.point.y + 3.2,
        smp.point.z + smp.right.z * (10.5 * side)
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lampPositions.push(dummy.matrix.clone());
    }
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 6.4, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
    lampPositions.forEach((m, idx) => poles.setMatrixAt(idx, m));
    poles.instanceMatrix.needsUpdate = true;
    poles.computeBoundingSphere();
    group.add(poles);

    const bulbGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({
      color: config.biome === 'neon_night' ? 0x22d3ee : 0xfef08a,
    });
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);
    for (let i = 0; i < lampPositions.length; i++) {
      dummy.matrix.copy(lampPositions[i]);
      dummy.position.setFromMatrixPosition(dummy.matrix);
      dummy.position.y += 3.2;
      dummy.updateMatrix();
      bulbs.setMatrixAt(i, dummy.matrix);
    }
    bulbs.instanceMatrix.needsUpdate = true;
    bulbs.computeBoundingSphere();
    group.add(bulbs);
  }
}
