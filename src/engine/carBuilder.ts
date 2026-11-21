import * as THREE from 'three';
import {
  CarCustomization,
  CarDamage,
  CarId,
  CarSpec,
  PaintFinish,
  RimStyle,
  SpoilerStyle,
  UnderglowColor,
  WindowTint,
} from '../types/game';
import {
  getContactShadowTexture,
  getTireSidewallTexture,
  getTireTreadTexture,
} from './textures';

export interface BuiltCarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group; // pitches/rolls on suspension
  wheelSteerGroups: [THREE.Group, THREE.Group]; // FL, FR
  wheelSpinMeshes: THREE.Group[]; // FL, FR, RL, RR
  headlightMats: THREE.MeshStandardMaterial[];
  headlightSpotLeft?: THREE.SpotLight;
  headlightSpotRight?: THREE.SpotLight;
  headlightBeams: THREE.Mesh[];
  brakeLightMat: THREE.MeshStandardMaterial;
  leftIndicatorMat: THREE.MeshStandardMaterial;
  rightIndicatorMat: THREE.MeshStandardMaterial;
  steeringWheel: THREE.Group;
  wiperLeft: THREE.Group;
  wiperRight: THREE.Group;
  rearMirrorScreen: THREE.Mesh;
  sideMirrorLeftScreen: THREE.Mesh;
  sideMirrorRightScreen: THREE.Mesh;
  underglowMesh?: THREE.Mesh;
  exhaustPositions: THREE.Vector3[];
  damageOverlays: THREE.Mesh[];
  dispose: () => void;
}

const UNDERGLOW_HEX: Record<UnderglowColor, number> = {
  none: 0x000000,
  cyan: 0x06b6d4,
  amber: 0xf59e0b,
  crimson: 0xef4444,
  emerald: 0x10b981,
  violet: 0x8b5cf6,
};

function createBodyPaintMaterial(
  colorHex: string,
  finish: PaintFinish
): THREE.MeshPhysicalMaterial {
  const color = new THREE.Color(colorHex);
  switch (finish) {
    case 'matte':
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.25,
        roughness: 0.68,
        clearcoat: 0.08,
        clearcoatRoughness: 0.6,
      });
    case 'metallic':
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.85,
        roughness: 0.22,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });
    case 'chrome':
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.98,
        roughness: 0.06,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      });
    case 'gloss':
    default:
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.45,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      });
  }
}

function createGlassMaterial(tint: WindowTint): THREE.MeshPhysicalMaterial {
  const tintMap: Record<WindowTint, { color: number; opacity: number }> = {
    clear: { color: 0xcbd5e1, opacity: 0.36 },
    smoke: { color: 0x334155, opacity: 0.56 },
    limo: { color: 0x090d16, opacity: 0.82 },
    cobalt: { color: 0x1d4ed8, opacity: 0.52 },
  };
  const cfg = tintMap[tint];
  return new THREE.MeshPhysicalMaterial({
    color: cfg.color,
    metalness: 0.1,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: cfg.opacity,
    depthWrite: false,
  });
}

/**
 * Generates an extruded side-profile chassis matching each supercar's real silhouette.
 */
function createCarSilhouetteGeometry(car: CarSpec): THREE.BufferGeometry {
  const L = car.dimensions.length;
  const H = car.dimensions.height;
  const W = car.dimensions.width;
  const halfL = L / 2;

  // Shape is drawn in 2D: X = longitudinal (-halfL rear .. +halfL front in shape space, rotated later)
  // Wait: let's define shape X = Z (-halfL = front, +halfL = rear), shape Y = height above groundClearance
  const s = new THREE.Shape();
  const base = 0.06;

  if (car.id === 'lamborghini' || car.id === 'aventador') {
    // Sharp Italian wedge silhouette (extended rear deck for SVJ)
    s.moveTo(-halfL, base + 0.06);
    s.lineTo(-halfL + 0.16, base + 0.28);
    s.lineTo(-halfL * 0.34, H * 0.62);
    s.lineTo(-halfL * 0.04, H * 0.96);
    s.lineTo(halfL * 0.4, H * 0.94);
    s.lineTo(halfL * 0.86, H * 0.66);
    s.lineTo(halfL, H * 0.58);
    s.lineTo(halfL - 0.06, base + 0.08);
    s.lineTo(-halfL + 0.08, base);
    s.closePath();
  } else if (car.id === 'bugatti') {
    // Rounded grand-tourer hypercar with muscular rear deck
    s.moveTo(-halfL, base + 0.08);
    s.quadraticCurveTo(-halfL + 0.1, base + 0.42, -halfL * 0.42, H * 0.58);
    s.quadraticCurveTo(-halfL * 0.14, H * 0.98, halfL * 0.12, H * 0.98);
    s.quadraticCurveTo(halfL * 0.55, H * 0.9, halfL * 0.92, H * 0.68);
    s.lineTo(halfL, H * 0.52);
    s.lineTo(halfL - 0.08, base + 0.06);
    s.lineTo(-halfL + 0.06, base);
    s.closePath();
  } else if (car.id === 'ferrari') {
    // Low sculpted mid-engine Ferrari berlinetta
    s.moveTo(-halfL, base + 0.05);
    s.quadraticCurveTo(-halfL + 0.15, base + 0.34, -halfL * 0.36, H * 0.56);
    s.lineTo(-halfL * 0.08, H * 0.96);
    s.lineTo(halfL * 0.3, H * 0.94);
    s.quadraticCurveTo(halfL * 0.68, H * 0.72, halfL, H * 0.64);
    s.lineTo(halfL - 0.05, base + 0.08);
    s.lineTo(-halfL + 0.06, base);
    s.closePath();
  } else if (car.id === 'porsche') {
    // Iconic 911 GT3 sloping fastback roofline & frog nose
    s.moveTo(-halfL, base + 0.08);
    s.quadraticCurveTo(-halfL + 0.2, H * 0.46, -halfL * 0.42, H * 0.56);
    s.quadraticCurveTo(-halfL * 0.15, H * 0.98, halfL * 0.12, H * 0.98);
    s.quadraticCurveTo(halfL * 0.62, H * 0.85, halfL * 0.94, H * 0.64);
    s.lineTo(halfL, H * 0.54);
    s.lineTo(halfL - 0.08, base + 0.06);
    s.lineTo(-halfL + 0.08, base);
    s.closePath();
  } else if (car.id === 'bmw') {
    // Front-engine 2-door GT coupe: long flat hood, upright cabin, muscular trunk
    s.moveTo(-halfL, base + 0.08);
    s.lineTo(-halfL + 0.08, H * 0.48);
    s.lineTo(-halfL * 0.24, H * 0.58);
    s.lineTo(-halfL * 0.02, H * 0.98);
    s.lineTo(halfL * 0.44, H * 0.97);
    s.lineTo(halfL * 0.72, H * 0.68);
    s.lineTo(halfL, H * 0.65);
    s.lineTo(halfL - 0.06, base + 0.08);
    s.lineTo(-halfL + 0.08, base);
    s.closePath();
  } else {
    // Hypercar extreme teardrop LMP-inspired prototype
    s.moveTo(-halfL, base + 0.04);
    s.lineTo(-halfL + 0.25, H * 0.36);
    s.lineTo(-halfL * 0.3, H * 0.54);
    s.quadraticCurveTo(-halfL * 0.05, H * 1.0, halfL * 0.26, H * 0.94);
    s.lineTo(halfL * 0.88, H * 0.56);
    s.lineTo(halfL, H * 0.52);
    s.lineTo(halfL - 0.06, base + 0.06);
    s.lineTo(-halfL + 0.1, base);
    s.closePath();
  }

  const bodyWidth = W * 0.88;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: bodyWidth,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.045,
    bevelSegments: 3,
    curveSegments: 14,
  });

  // ExtrudeGeometry extrudes along +Z; rotate -90 deg around Y so shape X becomes Z (front -Z, rear +Z),
  // and extrusion depth is along X, then center on X=0!
  geo.rotateY(-Math.PI / 2);
  geo.translate(bodyWidth / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

function buildWheelGroup(
  radius: number,
  width: number,
  rimStyle: RimStyle,
  treadTex: THREE.Texture,
  sidewallTex: THREE.Texture,
  caliperHex: string,
  isLeft: boolean
): { steerGroup: THREE.Group; spinGroup: THREE.Group } {
  const steerGroup = new THREE.Group();
  const spinGroup = new THREE.Group();
  steerGroup.add(spinGroup);

  const tireMatTread = new THREE.MeshStandardMaterial({
    map: treadTex,
    roughness: 0.86,
    metalness: 0.05,
  });
  const tireMatSide = new THREE.MeshStandardMaterial({
    map: sidewallTex,
    roughness: 0.78,
    metalness: 0.08,
  });

  // Tire cylinder (axis along X)
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, [tireMatTread, tireMatSide, tireMatSide]);
  tireMesh.castShadow = true;
  spinGroup.add(tireMesh);

  // Alloy rim barrel
  const rimRadius = radius * 0.67;
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimStyle === 'deep_gold' ? 0xd97706 : rimStyle === 'turbine' ? 0x334155 : 0xd4d4d8,
    metalness: 0.92,
    roughness: 0.18,
  });
  const barrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width * 0.88, 20, 1);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrelMesh = new THREE.Mesh(barrelGeo, rimMat);
  spinGroup.add(barrelMesh);

  // Spokes facing outward
  const sideSign = isLeft ? -1 : 1;
  const spokeCount =
    rimStyle === 'mesh' ? 10 : rimStyle === 'forged_y' ? 7 : rimStyle === 'turbine' ? 8 : 5;
  const spokeGeo = new THREE.BoxGeometry(0.03, rimRadius * 1.88, rimStyle === 'mesh' ? 0.025 : 0.055);
  for (let i = 0; i < spokeCount; i++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.position.x = sideSign * (width * 0.44);
    spoke.rotation.x = (i / spokeCount) * Math.PI;
    if (rimStyle === 'turbine') {
      spoke.rotation.y = sideSign * 0.2;
    }
    spinGroup.add(spoke);
  }

  // Center lock / hub cap
  const hubGeo = new THREE.CylinderGeometry(rimRadius * 0.22, rimRadius * 0.22, width * 0.95, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.8,
    roughness: 0.25,
  });
  spinGroup.add(new THREE.Mesh(hubGeo, hubMat));

  // Brake disc (rotates with wheel)
  const discGeo = new THREE.CylinderGeometry(rimRadius * 0.74, rimRadius * 0.74, 0.03, 18);
  discGeo.rotateZ(Math.PI / 2);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.88,
    roughness: 0.32,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.x = sideSign * (width * 0.16);
  spinGroup.add(disc);

  // Fixed Brake Caliper (attached to steerGroup so it does not spin!)
  const caliperGeo = new THREE.BoxGeometry(0.09, rimRadius * 0.56, rimRadius * 0.36);
  const caliperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(caliperHex),
    metalness: 0.45,
    roughness: 0.28,
  });
  const caliper = new THREE.Mesh(caliperGeo, caliperMat);
  caliper.position.set(sideSign * (width * 0.18), rimRadius * 0.2, -rimRadius * 0.52);
  steerGroup.add(caliper);

  return { steerGroup, spinGroup };
}

function addSpoiler(
  bodyGroup: THREE.Group,
  car: CarSpec,
  style: SpoilerStyle,
  carbonMat: THREE.Material,
  paintMat: THREE.Material
) {
  if (style === 'stock' && car.id !== 'porsche' && car.id !== 'hypercar') {
    // Subtle integrated rear lip
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(car.dimensions.width * 0.76, 0.04, 0.14),
      carbonMat
    );
    lip.position.set(0, car.dimensions.height * 0.66, car.dimensions.length * 0.46);
    lip.rotation.x = -0.25;
    bodyGroup.add(lip);
    return;
  }

  const rearZ = car.dimensions.length * 0.45;
  const deckY = car.dimensions.height * 0.66;
  const wingW = car.dimensions.width * 0.92;

  if (style === 'ducktail') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.88, 0.11, 0.2), paintMat);
    duck.position.set(0, deckY + 0.06, rearZ + 0.03);
    duck.rotation.x = -0.45;
    bodyGroup.add(duck);
    return;
  }

  // GT Carbon or Swan-Neck track wing
  const pylonHeight = style === 'swan_neck' ? 0.26 : 0.2;
  const pylonGeo = new THREE.BoxGeometry(0.04, pylonHeight, 0.18);
  const leftPylon = new THREE.Mesh(pylonGeo, carbonMat);
  leftPylon.position.set(-wingW * 0.25, deckY + pylonHeight * 0.5, rearZ);
  const rightPylon = new THREE.Mesh(pylonGeo, carbonMat);
  rightPylon.position.set(wingW * 0.25, deckY + pylonHeight * 0.5, rearZ);
  bodyGroup.add(leftPylon, rightPylon);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.035, 0.26), carbonMat);
  blade.position.set(0, deckY + pylonHeight + 0.01, rearZ + 0.04);
  blade.rotation.x = 0.12;
  blade.castShadow = true;
  bodyGroup.add(blade);

  const endPlateGeo = new THREE.BoxGeometry(0.025, 0.16, 0.3);
  const epL = new THREE.Mesh(endPlateGeo, paintMat);
  epL.position.set(-wingW / 2, deckY + pylonHeight, rearZ + 0.04);
  const epR = new THREE.Mesh(endPlateGeo, paintMat);
  epR.position.set(wingW / 2, deckY + pylonHeight, rearZ + 0.04);
  bodyGroup.add(epL, epR);
}

export function buildCarModel(
  car: CarSpec,
  customization: CarCustomization,
  damage: CarDamage,
  maxAnisotropy: number,
  options: {
    isPlayer: boolean;
    rearMirrorTexture?: THREE.Texture | null;
    isSoftwareGl?: boolean;
  }
): BuiltCarRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const { length: L, width: W, height: H, wheelbase, wheelRadius, wheelWidth } = car.dimensions;
  const halfL = L / 2;
  const halfW = W / 2;

  // Grounding contact shadow plane directly beneath car
  const shadowGeo = new THREE.PlaneGeometry(W * 1.45, L * 1.2);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // Primary Materials
  const paintMat = createBodyPaintMaterial(customization.paintColor, customization.paintFinish);
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x17191e,
    metalness: 0.35,
    roughness: 0.42,
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0d1017,
    metalness: 0.25,
    roughness: 0.65,
  });
  const glassMat = createGlassMaterial(customization.windowTint);

  // 1. Primary Silhouette Chassis
  const chassisGeo = createCarSilhouetteGeometry(car);
  const chassisMesh = new THREE.Mesh(chassisGeo, paintMat);
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  bodyGroup.add(chassisMesh);

  // Bugatti signature two-tone C-line & horseshoe grille accent
  if (car.id === 'bugatti') {
    const rearTone = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.9, H * 0.48, L * 0.44),
      carbonMat
    );
    rearTone.position.set(0, H * 0.4, L * 0.22);
    bodyGroup.add(rearTone);

    const grille = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.028, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 })
    );
    grille.position.set(0, 0.26, -halfL - 0.01);
    bodyGroup.add(grille);
  }

  // BMW twin-kidney grille
  if (car.id === 'bmw') {
    const kidneyGeo = new THREE.BoxGeometry(0.24, 0.22, 0.05);
    const kidneyMat = new THREE.MeshStandardMaterial({ color: 0x090b10, metalness: 0.6, roughness: 0.3 });
    const kL = new THREE.Mesh(kidneyGeo, kidneyMat);
    kL.position.set(-0.15, 0.32, -halfL - 0.01);
    const kR = new THREE.Mesh(kidneyGeo, kidneyMat);
    kR.position.set(0.15, 0.32, -halfL - 0.01);
    bodyGroup.add(kL, kR);
  }

  // 2. Cabin Glass Canopy & Windshield
  const canopyW = W * 0.72;
  const canopyL = L * 0.44;
  const canopyGeo = new THREE.BoxGeometry(canopyW, H * 0.36, canopyL);
  const canopy = new THREE.Mesh(canopyGeo, glassMat);
  canopy.position.set(0, H * 0.78, car.dimensions.cabinOffsetZ);
  canopy.rotation.x = 0.14;
  bodyGroup.add(canopy);

  // Sloped front windshield plane for wipers & cockpit view
  const windshieldGeo = new THREE.PlaneGeometry(canopyW * 0.95, 0.78);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0, H * 0.72, car.dimensions.cabinOffsetZ - canopyL * 0.48);
  windshield.rotation.x = -Math.PI * 0.32;
  bodyGroup.add(windshield);

  // 3. Body Kit (Front splitter, side skirts, widebody flares, rear diffuser)
  const kitWidthMult = customization.bodyKit === 'widebody' ? 1.07 : 1.0;
  const splitterMat = customization.bodyKit === 'carbon_aero' ? carbonMat : darkTrimMat;

  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.95 * kitWidthMult, 0.045, 0.42),
    splitterMat
  );
  splitter.position.set(0, 0.11, -halfL + 0.1);
  bodyGroup.add(splitter);

  const skirtGeo = new THREE.BoxGeometry(0.11, 0.06, wheelbase * 0.88);
  const skirtL = new THREE.Mesh(skirtGeo, splitterMat);
  skirtL.position.set(-halfW * 0.96 * kitWidthMult, 0.12, 0);
  const skirtR = new THREE.Mesh(skirtGeo, splitterMat);
  skirtR.position.set(halfW * 0.96 * kitWidthMult, 0.12, 0);
  bodyGroup.add(skirtL, skirtR);

  if (customization.bodyKit === 'widebody') {
    const flareGeo = new THREE.BoxGeometry(0.12, 0.34, wheelRadius * 2.35);
    const positions = [
      [-halfW * 0.96, 0.32, -wheelbase / 2],
      [halfW * 0.96, 0.32, -wheelbase / 2],
      [-halfW * 0.96, 0.32, wheelbase / 2],
      [halfW * 0.96, 0.32, wheelbase / 2],
    ];
    for (const [fx, fy, fz] of positions) {
      const flare = new THREE.Mesh(flareGeo, paintMat);
      flare.position.set(fx, fy, fz);
      bodyGroup.add(flare);
    }
  }

  // Rear diffuser + twin/quad exhaust pipes
  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.84, 0.16, 0.25),
    carbonMat
  );
  diffuser.position.set(0, 0.18, halfL - 0.04);
  bodyGroup.add(diffuser);

  const exhaustPositions: THREE.Vector3[] = [];
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.95, roughness: 0.2 });
  const pipeGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.14, 12);
  pipeGeo.rotateX(Math.PI / 2);
  const pipeOffsets = [-0.46, -0.34, 0.34, 0.46];
  for (const px of pipeOffsets) {
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.position.set(px, 0.18, halfL + 0.04);
    bodyGroup.add(pipe);
    exhaustPositions.push(new THREE.Vector3(px, 0.18, halfL + 0.12));
  }

  // 4. Spoiler
  addSpoiler(bodyGroup, car, customization.spoiler, carbonMat, paintMat);

  // 5. Headlights, Taillights, Brake Lights & Indicators
  const headlightMatL = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.8,
    roughness: 0.1,
  });
  const headlightMatR = headlightMatL.clone();
  const hlGeo =
    car.id === 'porsche'
      ? new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16)
      : new THREE.BoxGeometry(0.28, 0.08, 0.12);
  if (car.id === 'porsche') hlGeo.rotateX(Math.PI / 2);

  const hlL = new THREE.Mesh(hlGeo, headlightMatL);
  hlL.position.set(-halfW * 0.65, 0.38, -halfL + 0.12);
  const hlR = new THREE.Mesh(hlGeo, headlightMatR);
  hlR.position.set(halfW * 0.65, 0.38, -halfL + 0.12);
  bodyGroup.add(hlL, hlR);

  // Subtle volumetric light cones for headlights
  const beamGeo = new THREE.ConeGeometry(1.1, 6.5, 14, 1, true);
  beamGeo.translate(0, -3.25, 0);
  beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamL = new THREE.Mesh(beamGeo, beamMat);
  beamL.position.set(-halfW * 0.65, 0.36, -halfL);
  const beamR = new THREE.Mesh(beamGeo, beamMat);
  beamR.position.set(halfW * 0.65, 0.36, -halfL);
  bodyGroup.add(beamL, beamR);

  let headlightSpotLeft: THREE.SpotLight | undefined;
  let headlightSpotRight: THREE.SpotLight | undefined;
  if (options.isPlayer && !options.isSoftwareGl) {
    headlightSpotLeft = new THREE.SpotLight(0xf0f9ff, 8, 55, Math.PI / 6, 0.5, 1.5);
    headlightSpotLeft.position.set(-halfW * 0.6, 0.42, -halfL);
    headlightSpotLeft.target.position.set(-halfW * 0.4, 0.0, -halfL - 18);
    bodyGroup.add(headlightSpotLeft, headlightSpotLeft.target);

    headlightSpotRight = new THREE.SpotLight(0xf0f9ff, 8, 55, Math.PI / 6, 0.5, 1.5);
    headlightSpotRight.position.set(halfW * 0.6, 0.42, -halfL);
    headlightSpotRight.target.position.set(halfW * 0.4, 0.0, -halfL - 18);
    bodyGroup.add(headlightSpotRight, headlightSpotRight.target);
  }

  // Brake / Tail lights
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.8,
    roughness: 0.15,
  });
  const tlGeo = new THREE.BoxGeometry(0.38, 0.07, 0.08);
  const tlL = new THREE.Mesh(tlGeo, brakeLightMat);
  tlL.position.set(-halfW * 0.62, 0.52, halfL - 0.02);
  const tlR = new THREE.Mesh(tlGeo, brakeLightMat);
  tlR.position.set(halfW * 0.62, 0.52, halfL - 0.02);
  bodyGroup.add(tlL, tlR);

  // Indicators (front + rear amber)
  const leftIndicatorMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    emissive: 0xf59e0b,
    emissiveIntensity: 0,
  });
  const rightIndicatorMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    emissive: 0xf59e0b,
    emissiveIntensity: 0,
  });
  const indGeo = new THREE.BoxGeometry(0.14, 0.05, 0.08);
  const indFL = new THREE.Mesh(indGeo, leftIndicatorMat);
  indFL.position.set(-halfW * 0.82, 0.36, -halfL + 0.16);
  const indRL = new THREE.Mesh(indGeo, leftIndicatorMat);
  indRL.position.set(-halfW * 0.84, 0.52, halfL - 0.02);
  const indFR = new THREE.Mesh(indGeo, rightIndicatorMat);
  indFR.position.set(halfW * 0.82, 0.36, -halfL + 0.16);
  const indRR = new THREE.Mesh(indGeo, rightIndicatorMat);
  indRR.position.set(halfW * 0.84, 0.52, halfL - 0.02);
  bodyGroup.add(indFL, indRL, indFR, indRR);

  // 6. Side Mirrors & Cockpit Rear-View Mirror + Steering Wheel + Wipers
  const mirrorMat = options.rearMirrorTexture
    ? new THREE.MeshBasicMaterial({ map: options.rearMirrorTexture })
    : new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.08 });

  const sideShellGeo = new THREE.BoxGeometry(0.18, 0.09, 0.14);
  const smL = new THREE.Mesh(sideShellGeo, paintMat);
  smL.position.set(-halfW * 0.92, H * 0.62, -0.35);
  const smR = new THREE.Mesh(sideShellGeo, paintMat);
  smR.position.set(halfW * 0.92, H * 0.62, -0.35);
  bodyGroup.add(smL, smR);

  const sideScreenGeo = new THREE.PlaneGeometry(0.15, 0.07);
  const sideMirrorLeftScreen = new THREE.Mesh(sideScreenGeo, mirrorMat);
  sideMirrorLeftScreen.position.set(-halfW * 0.92, H * 0.62, -0.275);
  const sideMirrorRightScreen = new THREE.Mesh(sideScreenGeo, mirrorMat);
  sideMirrorRightScreen.position.set(halfW * 0.92, H * 0.62, -0.275);
  bodyGroup.add(sideMirrorLeftScreen, sideMirrorRightScreen);

  // Cockpit interior rear-view mirror
  const rearMirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.04), darkTrimMat);
  rearMirrorHousing.position.set(0, H * 0.88, car.dimensions.cabinOffsetZ - canopyL * 0.36);
  bodyGroup.add(rearMirrorHousing);

  const rearMirrorScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.065), mirrorMat);
  rearMirrorScreen.position.set(0, H * 0.88, car.dimensions.cabinOffsetZ - canopyL * 0.36 + 0.022);
  bodyGroup.add(rearMirrorScreen);

  // Cockpit Steering Wheel
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-0.34, H * 0.58, car.dimensions.cabinOffsetZ - 0.18);
  steeringWheel.rotation.x = -0.35;
  const swRim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 20), carbonMat);
  const swSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.02), darkTrimMat);
  const swCenter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.3 })
  );
  steeringWheel.add(swRim, swSpoke, swCenter);
  bodyGroup.add(steeringWheel);

  // Windshield Wipers
  const wiperLeft = new THREE.Group();
  wiperLeft.position.set(-0.38, H * 0.56, car.dimensions.cabinOffsetZ - canopyL * 0.64);
  const bladeL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.02), darkTrimMat);
  bladeL.position.set(0.21, 0.01, 0);
  wiperLeft.add(bladeL);

  const wiperRight = new THREE.Group();
  wiperRight.position.set(0.05, H * 0.56, car.dimensions.cabinOffsetZ - canopyL * 0.64);
  const bladeR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.02), darkTrimMat);
  bladeR.position.set(0.21, 0.01, 0);
  wiperRight.add(bladeR);
  bodyGroup.add(wiperLeft, wiperRight);

  // 7. Underglow Neon Strip
  let underglowMesh: THREE.Mesh | undefined;
  if (customization.underglow !== 'none') {
    const glowHex = UNDERGLOW_HEX[customization.underglow];
    const ugGeo = new THREE.PlaneGeometry(W * 0.92, L * 0.85);
    ugGeo.rotateX(-Math.PI / 2);
    const ugMat = new THREE.MeshBasicMaterial({
      color: glowHex,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    underglowMesh = new THREE.Mesh(ugGeo, ugMat);
    underglowMesh.position.y = 0.035;
    root.add(underglowMesh);
  }

  // 8. Damage Visuals (Scratches & Dent Panels)
  const damageOverlays: THREE.Mesh[] = [];
  const totalDmg = (damage.body + damage.engine + damage.tires) / 3;
  if (totalDmg > 10) {
    const scratchMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.85,
    });
    const count = Math.min(8, Math.ceil(totalDmg / 14));
    for (let i = 0; i < count; i++) {
      const scratch = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.02, 0.35 + (i % 3) * 0.14),
        scratchMat
      );
      const side = i % 2 === 0 ? -1 : 1;
      scratch.position.set(
        side * (halfW * 0.89),
        0.34 + (i % 3) * 0.09,
        ((i / count) - 0.5) * L * 0.7
      );
      scratch.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.18;
      bodyGroup.add(scratch);
      damageOverlays.push(scratch);
    }
  }

  // 9. Four Wheels (Custom Tread, Sidewall Branding, Rims, Calipers)
  const treadTex = getTireTreadTexture(customization.tireStyle, maxAnisotropy);
  const sidewallTex = getTireSidewallTexture(customization.tireStyle, maxAnisotropy);
  const trackHalfW = halfW * (customization.bodyKit === 'widebody' ? 0.94 : 0.88);
  const frontZ = -wheelbase / 2;
  const rearZ = wheelbase / 2;

  const fl = buildWheelGroup(
    wheelRadius,
    wheelWidth,
    customization.rimStyle,
    treadTex,
    sidewallTex,
    customization.caliperColor,
    true
  );
  fl.steerGroup.position.set(-trackHalfW, wheelRadius, frontZ);

  const fr = buildWheelGroup(
    wheelRadius,
    wheelWidth,
    customization.rimStyle,
    treadTex,
    sidewallTex,
    customization.caliperColor,
    false
  );
  fr.steerGroup.position.set(trackHalfW, wheelRadius, frontZ);

  const rl = buildWheelGroup(
    wheelRadius,
    wheelWidth * 1.1,
    customization.rimStyle,
    treadTex,
    sidewallTex,
    customization.caliperColor,
    true
  );
  rl.steerGroup.position.set(-trackHalfW, wheelRadius, rearZ);

  const rr = buildWheelGroup(
    wheelRadius,
    wheelWidth * 1.1,
    customization.rimStyle,
    treadTex,
    sidewallTex,
    customization.caliperColor,
    false
  );
  rr.steerGroup.position.set(trackHalfW, wheelRadius, rearZ);

  root.add(fl.steerGroup, fr.steerGroup, rl.steerGroup, rr.steerGroup);

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
  };

  return {
    root,
    bodyGroup,
    wheelSteerGroups: [fl.steerGroup, fr.steerGroup],
    wheelSpinMeshes: [fl.spinGroup, fr.spinGroup, rl.spinGroup, rr.spinGroup],
    headlightMats: [headlightMatL, headlightMatR],
    headlightSpotLeft,
    headlightSpotRight,
    headlightBeams: [beamL, beamR],
    brakeLightMat,
    leftIndicatorMat,
    rightIndicatorMat,
    steeringWheel,
    wiperLeft,
    wiperRight,
    rearMirrorScreen,
    sideMirrorLeftScreen,
    sideMirrorRightScreen,
    underglowMesh,
    exhaustPositions,
    damageOverlays,
    dispose,
  };
}

/**
 * Lightweight LOD wrapper for AI rival cars: full rig < 85m, simplified silhouette >= 85m.
 */
export function buildOpponentCarLOD(
  car: CarSpec,
  colorHex: string,
  maxAnisotropy: number
): { lod: THREE.LOD; rig: BuiltCarRig } {
  const lod = new THREE.LOD();
  const custom = {
    paintColor: colorHex,
    paintFinish: 'gloss' as PaintFinish,
    rimStyle: 'sport5' as RimStyle,
    tireStyle: 'street' as const,
    caliperColor: '#ef4444',
    spoiler: (car.id === 'porsche' ? 'swan_neck' : 'gt_carbon') as SpoilerStyle,
    bodyKit: 'stock' as const,
    windowTint: 'limo' as WindowTint,
    underglow: 'none' as UnderglowColor,
    unlockedItems: [],
  };
  const rig = buildCarModel(car, custom, { body: 0, engine: 0, tires: 0 }, maxAnisotropy, {
    isPlayer: false,
    isSoftwareGl: true,
  });

  // Low-detail proxy for far distance
  const lowGroup = new THREE.Group();
  const proxyGeo = new THREE.BoxGeometry(
    car.dimensions.width * 0.9,
    car.dimensions.height * 0.72,
    car.dimensions.length
  );
  const proxyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.35,
    metalness: 0.5,
  });
  const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
  proxyMesh.position.y = car.dimensions.height * 0.42;
  lowGroup.add(proxyMesh);

  lod.addLevel(rig.root, 0);
  lod.addLevel(lowGroup, 90);

  return { lod, rig };
}

export function getCarDisplayTag(id: CarId): string {
  switch (id) {
    case 'lamborghini':
      return 'V10 NA · 7-SPD LDF';
    case 'aventador':
      return 'V12 NA · 7-SPD ISR';
    case 'bugatti':
      return 'W16 QUAD-TURBO · 7-SPD';
    case 'ferrari':
      return 'TWIN-TURBO V8 · 7-SPD';
    case 'porsche':
      return 'FLAT-6 · 7-SPD PDK';
    case 'bmw':
      return 'INLINE-6 · 8-SPD STEPTRONIC';
    case 'hypercar':
      return 'HYBRID V8 · 9-SPD LST';
  }
}
