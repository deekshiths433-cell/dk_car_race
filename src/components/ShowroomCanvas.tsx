import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { CAR_MAP } from '../data/cars';
import { buildCarModel, BuiltCarRig } from '../engine/carBuilder';
import { checkWebGLSupport } from '../engine/webglSupport';
import { CarCustomization, CarDamage, CarId } from '../types/game';

interface ShowroomCanvasProps {
  carId: CarId;
  customization: CarCustomization;
  damage: CarDamage;
  interactive?: boolean;
  cameraShiftX?: number;
  className?: string;
}

const UNDERGLOW_CSS: Record<CarCustomization['underglow'], string> = {
  none: 'transparent',
  cyan: 'rgba(6, 182, 212, 0.55)',
  amber: 'rgba(245, 158, 11, 0.55)',
  crimson: 'rgba(239, 68, 68, 0.55)',
  emerald: 'rgba(16, 185, 129, 0.55)',
  violet: 'rgba(139, 92, 246, 0.55)',
};

function draw2DCarFallback(
  canvas: HTMLCanvasElement,
  carId: CarId,
  customization: CarCustomization,
  damage: CarDamage
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Dark studio gradient
  const bg = ctx.createRadialGradient(w * 0.55, h * 0.45, 40, w * 0.55, h * 0.5, w * 0.7);
  bg.addColorStop(0, '#141b2c');
  bg.addColorStop(1, '#080a0f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.56;
  const cy = h * 0.56;
  const scale = Math.min(w / 720, h / 460);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Turntable rings
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 58, 250, 52, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 58, 290, 62, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Underglow
  if (customization.underglow !== 'none') {
    const ug = ctx.createRadialGradient(0, 52, 10, 0, 52, 210);
    ug.addColorStop(0, UNDERGLOW_CSS[customization.underglow]);
    ug.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ug;
    ctx.beginPath();
    ctx.ellipse(0, 52, 210, 38, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.ellipse(0, 54, 200, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spoiler
  if (customization.spoiler !== 'stock' || carId === 'porsche' || carId === 'aventador') {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(150, -48, 12, 34);
    ctx.beginPath();
    ctx.moveTo(132, -52);
    ctx.lineTo(192, -58);
    ctx.lineTo(196, -48);
    ctx.lineTo(132, -46);
    ctx.closePath();
    ctx.fill();
  }

  // Supercar side silhouette
  ctx.beginPath();
  if (carId === 'bmw') {
    ctx.moveTo(-210, 26);
    ctx.lineTo(-195, -14);
    ctx.lineTo(-82, -26);
    ctx.lineTo(-22, -62);
    ctx.lineTo(95, -60);
    ctx.lineTo(165, -24);
    ctx.lineTo(205, -20);
    ctx.lineTo(196, 30);
  } else if (carId === 'porsche') {
    ctx.moveTo(-205, 28);
    ctx.quadraticCurveTo(-185, -18, -85, -26);
    ctx.quadraticCurveTo(-20, -64, 55, -62);
    ctx.quadraticCurveTo(138, -46, 198, -16);
    ctx.lineTo(194, 30);
  } else {
    ctx.moveTo(-215, 28);
    ctx.lineTo(-180, -8);
    ctx.lineTo(-78, -26);
    ctx.lineTo(-10, -60);
    ctx.lineTo(86, -58);
    ctx.lineTo(188, -24);
    ctx.lineTo(205, 28);
  }
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(0, -65, 0, 32);
  bodyGrad.addColorStop(0, customization.paintColor);
  bodyGrad.addColorStop(
    0.5,
    customization.paintFinish === 'chrome' ? '#e2e8f0' : customization.paintColor
  );
  bodyGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glass canopy
  ctx.beginPath();
  ctx.moveTo(-66, -24);
  ctx.lineTo(-12, -52);
  ctx.lineTo(74, -50);
  ctx.lineTo(114, -24);
  ctx.closePath();
  ctx.fillStyle =
    customization.windowTint === 'cobalt'
      ? 'rgba(29, 78, 216, 0.75)'
      : 'rgba(15, 23, 42, 0.85)';
  ctx.fill();

  // Headlight & Taillight glow
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(-198, -6, 22, 7);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(184, -14, 18, 7);

  // Wheels + Calipers
  for (const wx of [-128, 126]) {
    ctx.fillStyle = '#111318';
    ctx.beginPath();
    ctx.arc(wx, 28, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle =
      customization.rimStyle === 'deep_gold' ? '#d97706' : '#cbd5e1';
    ctx.beginPath();
    ctx.arc(wx, 28, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = customization.caliperColor;
    ctx.fillRect(wx + 6, 16, 8, 14);

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(wx, 28, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Damage scratches overlay
  const avgDmg = (damage.body + damage.engine + damage.tires) / 3;
  if (avgDmg > 10) {
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 2;
    const count = Math.min(7, Math.ceil(avgDmg / 15));
    for (let i = 0; i < count; i++) {
      const sx = -100 + i * 35;
      ctx.beginPath();
      ctx.moveTo(sx, -4);
      ctx.lineTo(sx + 24, 10);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export const ShowroomCanvas: React.FC<ShowroomCanvasProps> = ({
  carId,
  customization,
  damage,
  interactive = true,
  cameraShiftX = 0,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rigRef = useRef<BuiltCarRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const support = checkWebGLSupport();
    if (!support.supported) {
      setWebglUnavailable(true);
      return;
    }

    const isSoftwareGl = support.isSoftwareGl;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'default',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    setWebglUnavailable(false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = Math.max(300, container.clientWidth);
    const h = Math.max(220, container.clientHeight);
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090c14);
    scene.fog = new THREE.FogExp2(0x090c14, 0.036);
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(38, w / h, 0.2, 120);
    camera.position.set(4.5, 2.0, 5.2);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cameraShiftX, 0.65, 0);
    controls.enablePan = false;
    controls.minDistance = 3.4;
    controls.maxDistance = 9.5;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.enableZoom = interactive;
    controls.enableRotate = interactive;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.autoRotate = !isSoftwareGl;
    controls.autoRotateSpeed = 0.85;
    controls.update();
    controlsRef.current = controls;

    // 3-Point Studio Lighting + Softboxes
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.65);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    keyLight.position.set(6, 10, 7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    rimLight.position.set(-7, 4, -6);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xffffff, 4.5, 7, 2.2);
      softbox.position.set(0, 4.8, 0);
      softbox.lookAt(0, 0, 0);
      scene.add(softbox);
    }

    // Polished Showroom Floor & Turntable Ring
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0d111a,
      roughness: 0.28,
      metalness: 0.55,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    scene.add(floor);

    const ringGeo = new THREE.RingGeometry(2.85, 2.94, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.55,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.015;
    scene.add(ring);

    const outerRingGeo = new THREE.RingGeometry(3.3, 3.33, 64);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRing = new THREE.Mesh(
      outerRingGeo,
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 })
    );
    outerRing.position.y = 0.015;
    scene.add(outerRing);

    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (st === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const requestRender = () => {
      if (disposed) return;
      if (!isSoftwareGl) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        afterDraw(() => {
          renderBusy = false;
          if (renderDirty) requestRender();
        });
      });
    };
    requestRenderRef.current = requestRender;

    controls.addEventListener('change', requestRender);

    const onResize = () => {
      if (disposed || !container) return;
      const rw = Math.max(300, container.clientWidth);
      const rh = Math.max(220, container.clientHeight);
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    if (isSoftwareGl) {
      requestRender();
    } else {
      const tick = () => {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      rigRef.current?.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      outerRingGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [interactive, cameraShiftX]);

  // Rebuild 3D car model OR redraw 2D fallback canvas when props change
  useEffect(() => {
    if (webglUnavailable) {
      const redraw = () => {
        const c = fallbackCanvasRef.current;
        const container = mountRef.current;
        if (c && container) {
          c.width = Math.max(320, container.clientWidth);
          c.height = Math.max(220, container.clientHeight);
          draw2DCarFallback(c, carId, customization, damage);
        }
      };
      redraw();
      window.addEventListener('resize', redraw);
      return () => window.removeEventListener('resize', redraw);
    }

    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    if (rigRef.current) {
      scene.remove(rigRef.current.root);
      rigRef.current.dispose();
      rigRef.current = null;
    }

    const spec = CAR_MAP[carId];
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const rig = buildCarModel(spec, customization, damage, maxAniso, {
      isPlayer: false,
      isSoftwareGl: true,
    });
    rig.root.rotation.y = Math.PI * 0.12;
    scene.add(rig.root);
    rigRef.current = rig;
    requestRenderRef.current();
  }, [carId, customization, damage, webglUnavailable]);

  useEffect(() => {
    if (!webglUnavailable && controlsRef.current) {
      controlsRef.current.target.set(cameraShiftX, 0.65, 0);
      controlsRef.current.update();
      requestRenderRef.current();
    }
  }, [cameraShiftX, webglUnavailable]);

  return (
    <div ref={mountRef} className={`w-full h-full relative ${className}`}>
      {webglUnavailable && (
        <canvas
          ref={fallbackCanvasRef}
          className="w-full h-full block"
          aria-label="Supercar Showroom Preview"
        />
      )}
    </div>
  );
};
