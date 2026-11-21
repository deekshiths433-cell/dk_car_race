import {
  Achievement,
  BiomeId,
  BodyKitStyle,
  LevelConfig,
  PaintFinish,
  RimStyle,
  SpoilerStyle,
  TireStyle,
  UnderglowColor,
  WindowTint,
} from '../types/game';

export interface BiomePalette {
  id: BiomeId;
  label: string;
  skyDay: string;
  skySunset: string;
  skyNight: string;
  groundColor: string;
  roadColor: string;
  curbA: string;
  curbB: string;
  accent: string;
}

export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  city: {
    id: 'city',
    label: 'Metro City Circuit',
    skyDay: '#7fb3d5',
    skySunset: '#d97757',
    skyNight: '#0b1020',
    groundColor: '#2c353f',
    roadColor: '#1e242b',
    curbA: '#ef4444',
    curbB: '#f8fafc',
    accent: '#38bdf8',
  },
  desert: {
    id: 'desert',
    label: 'Desert Highway',
    skyDay: '#8ecae6',
    skySunset: '#e76f51',
    skyNight: '#121324',
    groundColor: '#b57c4a',
    roadColor: '#252629',
    curbA: '#f59e0b',
    curbB: '#fef3c7',
    accent: '#f59e0b',
  },
  mountain: {
    id: 'mountain',
    label: 'Alpine Mountain Pass',
    skyDay: '#73a9d8',
    skySunset: '#c97b63',
    skyNight: '#0c1628',
    groundColor: '#3e5641',
    roadColor: '#23272e',
    curbA: '#f97316',
    curbB: '#e2e8f0',
    accent: '#fb923c',
  },
  coastal: {
    id: 'coastal',
    label: 'Pacific Coastal Road',
    skyDay: '#67b7dc',
    skySunset: '#f4845f',
    skyNight: '#0a1626',
    groundColor: '#c2a878',
    roadColor: '#262b33',
    curbA: '#06b6d4',
    curbB: '#f8fafc',
    accent: '#06b6d4',
  },
  snow: {
    id: 'snow',
    label: 'Nordic Snowy Forest',
    skyDay: '#b8cde0',
    skySunset: '#9b8ea9',
    skyNight: '#0d1526',
    groundColor: '#dde7f0',
    roadColor: '#2f3846',
    curbA: '#38bdf8',
    curbB: '#ffffff',
    accent: '#7dd3fc',
  },
  neon_night: {
    id: 'neon_night',
    label: 'Night Neon Expressway',
    skyDay: '#1e293b',
    skySunset: '#3b1d4a',
    skyNight: '#060813',
    groundColor: '#111622',
    roadColor: '#141923',
    curbA: '#ec4899',
    curbB: '#06b6d4',
    accent: '#22d3ee',
  },
};

export const BASE_LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: 'Metro Harbor Sprint',
    biome: 'city',
    weather: 'clear',
    timeOfDay: 'day',
    laps: 2,
    aiCount: 3,
    aiSpeedMultiplier: 0.78,
    turnTightness: 0.35,
    obstacleDensity: 0.15,
    trackLengthMeters: 1650,
    rewardFirst: 1400,
    rewardSecond: 900,
    rewardThird: 600,
    rewardParticipation: 320,
    description: 'Wide city boulevards and sweeping corners. Ideal for dialing in braking and nitro.',
  },
  {
    level: 2,
    name: 'Red Rock Highway',
    biome: 'desert',
    weather: 'clear',
    timeOfDay: 'sunset',
    laps: 2,
    aiCount: 3,
    aiSpeedMultiplier: 0.85,
    turnTightness: 0.48,
    obstacleDensity: 0.28,
    trackLengthMeters: 1850,
    rewardFirst: 1900,
    rewardSecond: 1200,
    rewardThird: 800,
    rewardParticipation: 400,
    description: 'Golden-hour canyon straights with high-speed chicanes and roadside barriers.',
  },
  {
    level: 3,
    name: 'Riviera Cliffside',
    biome: 'coastal',
    weather: 'rain',
    timeOfDay: 'day',
    laps: 2,
    aiCount: 4,
    aiSpeedMultiplier: 0.9,
    turnTightness: 0.58,
    obstacleDensity: 0.35,
    trackLengthMeters: 1950,
    rewardFirst: 2500,
    rewardSecond: 1600,
    rewardThird: 1050,
    rewardParticipation: 500,
    description: 'Wet coastal asphalt overlooking the ocean. Wipers engage automatically; watch braking zones.',
  },
  {
    level: 4,
    name: 'Alpine Switchbacks',
    biome: 'mountain',
    weather: 'fog',
    timeOfDay: 'day',
    laps: 3,
    aiCount: 4,
    aiSpeedMultiplier: 0.96,
    turnTightness: 0.72,
    obstacleDensity: 0.45,
    trackLengthMeters: 2150,
    rewardFirst: 3200,
    rewardSecond: 2100,
    rewardThird: 1400,
    rewardParticipation: 650,
    description: 'Technical mountain hairpins wrapped in valley mist. Precision drift control wins.',
  },
  {
    level: 5,
    name: 'Nordic Timber Frost',
    biome: 'snow',
    weather: 'snow',
    timeOfDay: 'sunset',
    laps: 3,
    aiCount: 5,
    aiSpeedMultiplier: 1.02,
    turnTightness: 0.82,
    obstacleDensity: 0.55,
    trackLengthMeters: 2250,
    rewardFirst: 4200,
    rewardSecond: 2700,
    rewardThird: 1800,
    rewardParticipation: 800,
    description: 'Snowfall reduces lateral traction across pine-lined S-curves against fierce rivals.',
  },
  {
    level: 6,
    name: 'Midnight Neon Grand Prix',
    biome: 'neon_night',
    weather: 'rain',
    timeOfDay: 'night',
    laps: 3,
    aiCount: 5,
    aiSpeedMultiplier: 1.08,
    turnTightness: 0.92,
    obstacleDensity: 0.68,
    trackLengthMeters: 2450,
    rewardFirst: 6000,
    rewardSecond: 3800,
    rewardThird: 2500,
    rewardParticipation: 1000,
    description: 'Championship finale under wet neon towers. Victory unlocks the DK Apex-X Hypercar.',
  },
];

export function getLevelConfig(levelNum: number): LevelConfig {
  if (levelNum <= BASE_LEVELS.length) {
    return BASE_LEVELS[Math.max(0, levelNum - 1)];
  }
  const biomes: BiomeId[] = ['city', 'desert', 'coastal', 'mountain', 'snow', 'neon_night'];
  const weathers: LevelConfig['weather'][] = ['clear', 'rain', 'fog', 'snow'];
  const times: LevelConfig['timeOfDay'][] = ['day', 'sunset', 'night'];
  const idx = (levelNum - 1) % biomes.length;
  const biome = biomes[idx];
  const weather = biome === 'snow' ? 'snow' : weathers[(levelNum * 3) % 3];
  const timeOfDay = biome === 'neon_night' ? 'night' : times[(levelNum + 1) % times.length];
  const tier = levelNum - BASE_LEVELS.length;

  return {
    level: levelNum,
    name: `Pro Championship Stage ${levelNum}`,
    biome,
    weather,
    timeOfDay,
    laps: 3,
    aiCount: 5,
    aiSpeedMultiplier: Math.min(1.24, 1.08 + tier * 0.03),
    turnTightness: Math.min(1.0, 0.88 + tier * 0.02),
    obstacleDensity: Math.min(0.85, 0.65 + tier * 0.04),
    trackLengthMeters: 2400 + tier * 150,
    rewardFirst: 6000 + tier * 850,
    rewardSecond: 3800 + tier * 500,
    rewardThird: 2500 + tier * 350,
    rewardParticipation: 1000 + tier * 150,
    description: `Elite procedural circuit #${levelNum} with aggressive hypercar rivals and tight chicanes.`,
  };
}

export const PAINT_SWATCHES = [
  { name: 'Rosso Corsa', hex: '#dc2626', price: 350 },
  { name: 'Giallo Modena', hex: '#f59e0b', price: 350 },
  { name: 'Electric Cobalt', hex: '#1d4ed8', price: 350 },
  { name: 'Chiron Cyan', hex: '#0284c7', price: 450 },
  { name: 'Emerald Apex', hex: '#10b981', price: 450 },
  { name: 'Obsidian Black', hex: '#111827', price: 400 },
  { name: 'Alabaster Pearl', hex: '#e2e8f0', price: 400 },
  { name: 'British Racing', hex: '#065f46', price: 500 },
  { name: 'Viola Parsifae', hex: '#7c3aed', price: 600 },
  { name: 'Acid Lime', hex: '#84cc16', price: 550 },
];

export const PAINT_FINISHES: { id: PaintFinish; label: string; price: number }[] = [
  { id: 'gloss', label: 'Factory Gloss', price: 0 },
  { id: 'metallic', label: 'Deep Metallic', price: 450 },
  { id: 'matte', label: 'Stealth Matte', price: 600 },
  { id: 'chrome', label: 'Liquid Chrome', price: 1100 },
];

export const RIM_STYLES: { id: RimStyle; label: string; price: number }[] = [
  { id: 'sport5', label: '5-Spoke Sport', price: 0 },
  { id: 'mesh', label: 'BBS Track Mesh', price: 500 },
  { id: 'turbine', label: 'Aero Turbine', price: 750 },
  { id: 'forged_y', label: 'Forged Y-Spoke', price: 900 },
  { id: 'deep_gold', label: 'Deep Dish Gold', price: 1200 },
];

export const TIRE_STYLES: { id: TireStyle; label: string; price: number }[] = [
  { id: 'street', label: 'Street Sport', price: 0 },
  { id: 'semi_slick', label: 'Track Semi-Slick', price: 450 },
  { id: 'racing_white', label: 'White-Letter Slick', price: 700 },
  { id: 'all_weather', label: 'All-Weather Tread', price: 550 },
];

export const CALIPER_COLORS = [
  { name: 'Brembo Red', hex: '#ef4444', price: 0 },
  { name: 'Racing Yellow', hex: '#eab308', price: 250 },
  { name: 'Acid Green', hex: '#84cc16', price: 300 },
  { name: 'Cobalt Blue', hex: '#3b82f6', price: 300 },
  { name: 'Carbon Gold', hex: '#d97706', price: 400 },
];

export const SPOILER_STYLES: { id: SpoilerStyle; label: string; price: number }[] = [
  { id: 'stock', label: 'Stock Active Lip', price: 0 },
  { id: 'ducktail', label: 'Carbon Ducktail', price: 550 },
  { id: 'gt_carbon', label: 'GT Carbon Wing', price: 900 },
  { id: 'swan_neck', label: 'Swan-Neck Track', price: 1350 },
];

export const BODYKIT_STYLES: { id: BodyKitStyle; label: string; price: number }[] = [
  { id: 'stock', label: 'Factory Aero', price: 0 },
  { id: 'carbon_aero', label: 'Carbon Splitter Kit', price: 850 },
  { id: 'widebody', label: 'GT Widebody Kit', price: 1450 },
];

export const WINDOW_TINTS: { id: WindowTint; label: string; price: number }[] = [
  { id: 'clear', label: 'Clear Glass', price: 200 },
  { id: 'smoke', label: 'Sport Smoke', price: 0 },
  { id: 'limo', label: 'Stealth Limo', price: 450 },
  { id: 'cobalt', label: 'Iridescent Blue', price: 650 },
];

export const UNDERGLOW_COLORS: { id: UnderglowColor; label: string; hex: string; price: number }[] = [
  { id: 'none', label: 'Off', hex: '#000000', price: 0 },
  { id: 'cyan', label: 'Electric Cyan', hex: '#06b6d4', price: 550 },
  { id: 'amber', label: 'Amber Gold', hex: '#f59e0b', price: 550 },
  { id: 'crimson', label: 'Crimson Red', hex: '#ef4444', price: 550 },
  { id: 'emerald', label: 'Apex Emerald', hex: '#10b981', price: 600 },
  { id: 'violet', label: 'Ultra Violet', hex: '#8b5cf6', price: 650 },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_win',
    title: 'Checkered Flag',
    description: 'Win your first race in DK Car Race.',
    reward: 600,
    unlocked: false,
  },
  {
    id: 'clean_sweep',
    title: 'Surgical Line',
    description: 'Finish a race with less than 5% total damage.',
    reward: 800,
    unlocked: false,
  },
  {
    id: 'drift_king',
    title: 'Sideways Master',
    description: 'Accumulate 1,500 meters of drifting across races.',
    reward: 1000,
    unlocked: false,
  },
  {
    id: 'rain_master',
    title: 'Storm Chaser',
    description: 'Win a race in Rain or Snow weather.',
    reward: 900,
    unlocked: false,
  },
  {
    id: 'collector',
    title: 'Supercar Collector',
    description: 'Own at least 3 different supercars in your garage.',
    reward: 1500,
    unlocked: false,
  },
  {
    id: 'hyper_champion',
    title: 'Midnight Apex Champion',
    description: 'Conquer Level 6 (Midnight Neon Grand Prix).',
    reward: 2500,
    unlocked: false,
  },
];
