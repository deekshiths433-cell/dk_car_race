import * as THREE from 'three';
import { BiomeId, TireStyle } from '../types/game';

const textureCache = new Map<string, THREE.Texture>();

function finalizeTexture(
  tex: THREE.CanvasTexture,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
) {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function getAsphaltTexture(
  biome: BiomeId,
  wet: boolean,
  maxAnisotropy: number
): THREE.Texture {
  const key = `asphalt_${biome}_${wet ? 'wet' : 'dry'}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const base = biome === 'snow' ? '#364152' : biome === 'neon_night' ? '#121722' : '#242930';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  // Fine asphalt grain
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 25 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 5},0.35)`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Wet puddle sheen patches
  if (wet) {
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 30 + Math.random() * 65;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
      g.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // White shoulder edge lines
  ctx.fillStyle = biome === 'neon_night' ? '#22d3ee' : '#e2e8f0';
  ctx.fillRect(18, 0, 8, 512);
  ctx.fillRect(486, 0, 8, 512);

  // Dashed centerline
  ctx.fillStyle = biome === 'neon_night' ? '#f59e0b' : '#fbbf24';
  for (let y = 16; y < 512; y += 64) {
    ctx.fillRect(252, y, 8, 34);
  }

  const tex = finalizeTexture(new THREE.CanvasTexture(canvas), true, maxAnisotropy, 1, 1);
  textureCache.set(key, tex);
  return tex;
}

export function getTireTreadTexture(style: TireStyle, maxAnisotropy: number): THREE.Texture {
  const key = `tread_${style}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18191c';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#090a0c';
  ctx.lineWidth = style === 'semi_slick' || style === 'racing_white' ? 4 : 7;

  if (style === 'semi_slick' || style === 'racing_white') {
    // Twin circumferential racing grooves + diagonal sipes
    ctx.fillStyle = '#0a0b0d';
    ctx.fillRect(72, 0, 10, 256);
    ctx.fillRect(174, 0, 10, 256);
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(65, y + 18);
      ctx.moveTo(246, y);
      ctx.lineTo(191, y + 18);
      ctx.stroke();
    }
  } else {
    // Aggressive directional V-tread
    for (let y = -16; y < 272; y += 24) {
      ctx.beginPath();
      ctx.moveTo(128, y);
      ctx.lineTo(16, y + 22);
      ctx.moveTo(128, y);
      ctx.lineTo(240, y + 22);
      ctx.stroke();
    }
  }

  const tex = finalizeTexture(new THREE.CanvasTexture(canvas), true, maxAnisotropy, 1, 4);
  textureCache.set(key, tex);
  return tex;
}

export function getTireSidewallTexture(style: TireStyle, maxAnisotropy: number): THREE.Texture {
  const key = `sidewall_${style}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#17191d';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle radial ribbing on sidewall
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(256, 256, 228, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(256, 256, 175, 0, Math.PI * 2);
  ctx.stroke();

  // Sidewall branding
  const label =
    style === 'racing_white'
      ? 'PIRELLI  P ZERO  CORSA'
      : style === 'semi_slick'
      ? 'MICHELIN  PILOT  SPORT'
      : style === 'all_weather'
      ? 'DK  ALL-TERRAIN  GT'
      : 'P ZERO  SUPERCAR';
  const textColor = style === 'racing_white' ? '#f8fafc' : '#94a3b8';

  ctx.save();
  ctx.translate(256, 256);
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < label.length; i++) {
    const angle = -Math.PI / 2 + (i - label.length / 2) * 0.085;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillText(label[i], 0, -202);
    ctx.restore();
  }
  for (let i = 0; i < label.length; i++) {
    const angle = Math.PI / 2 + (i - label.length / 2) * 0.085;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillText(label[i], 0, -202);
    ctx.restore();
  }
  ctx.restore();

  const tex = finalizeTexture(new THREE.CanvasTexture(canvas), true, maxAnisotropy, 1, 1);
  textureCache.set(key, tex);
  return tex;
}

export function getStartFinishTexture(maxAnisotropy: number): THREE.Texture {
  const key = 'start_finish_banner';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      const dark = ((x / sq) + (y / sq)) % 2 === 0;
      ctx.fillStyle = dark ? '#0f172a' : '#f8fafc';
      ctx.fillRect(x, y, sq, sq);
    }
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  ctx.fillRect(104, 24, 304, 80);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.strokeRect(104, 24, 304, 80);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DK CAR RACE', 256, 65);

  const tex = finalizeTexture(new THREE.CanvasTexture(canvas), true, maxAnisotropy, 1, 1);
  textureCache.set(key, tex);
  return tex;
}

export function getCheckeredStripTexture(maxAnisotropy: number): THREE.Texture {
  const key = 'checkered_strip';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      ctx.fillStyle = ((x / sq) + (y / sq)) % 2 === 0 ? '#0f172a' : '#ffffff';
      ctx.fillRect(x, y, sq, sq);
    }
  }
  const tex = finalizeTexture(new THREE.CanvasTexture(canvas), true, maxAnisotropy, 2, 1);
  textureCache.set(key, tex);
  return tex;
}

export function getContactShadowTexture(): THREE.Texture {
  const key = 'contact_shadow';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 22, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0,0,0,0.78)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.42)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

export function getGroundTexture(biome: BiomeId, maxAnisotropy: number): THREE.Texture {
  const key = `ground_${biome}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const palette: Record<BiomeId, [string, string]> = {
    city: ['#2b333d', '#222931'],
    desert: ['#b87e4c', '#a36b3c'],
    mountain: ['#3a523e', '#2d4231'],
    coastal: ['#c2a878', '#b29768'],
    snow: ['#dde8f2', '#cddbe8'],
    neon_night: ['#0e131e', '#151c2c'],
  };
  const [c1, c2] = palette[biome];
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = c2;
  for (let i = 0; i < 800; i++) {
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
  }

  const tex = finalizeTexture(new THREE.CanvasTexture(canvas), true, maxAnisotropy, 60, 60);
  textureCache.set(key, tex);
  return tex;
}
