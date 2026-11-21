import {
  CARS,
  CAR_MAP,
  createDefaultCustomization,
  createDefaultDamage,
  createDefaultUpgrades,
} from '../data/cars';
import { INITIAL_ACHIEVEMENTS } from '../data/tracks';
import {
  CarId,
  DailyMission,
  LeaderboardEntry,
  RaceResult,
  SaveData,
} from '../types/game';

const STORAGE_KEY = 'dk_car_race_save_v1';

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateDailyMissions(): DailyMission[] {
  return [
    {
      id: 'dm_win',
      title: 'Podium Hunter',
      description: 'Win 2 races in any biome.',
      target: 2,
      progress: 0,
      reward: 1100,
      claimed: false,
      type: 'win_races',
    },
    {
      id: 'dm_drift',
      title: 'Tire Smoke',
      description: 'Drift a total of 350 meters.',
      target: 350,
      progress: 0,
      reward: 850,
      claimed: false,
      type: 'drift_meters',
    },
    {
      id: 'dm_clean',
      title: 'Scratch-Free',
      description: 'Finish a race with under 10% damage.',
      target: 1,
      progress: 0,
      reward: 950,
      claimed: false,
      type: 'clean_finish',
    },
  ];
}

function createInitialLeaderboard(): LeaderboardEntry[] {
  return [
    {
      id: 'seed_1',
      playerName: 'K. Takahashi',
      carId: 'porsche',
      carName: 'Porsche 911 GT3',
      biome: 'city',
      level: 1,
      timeMs: 68420,
      bestLapMs: 33210,
      date: Date.now() - 86400000 * 2,
    },
    {
      id: 'seed_2',
      playerName: 'M. Vance',
      carId: 'lamborghini',
      carName: 'Lamborghini Huracán EVO',
      biome: 'desert',
      level: 2,
      timeMs: 74910,
      bestLapMs: 36480,
      date: Date.now() - 86400000,
    },
    {
      id: 'seed_3',
      playerName: 'E. Rossi',
      carId: 'ferrari',
      carName: 'Ferrari 488 Pista',
      biome: 'neon_night',
      level: 6,
      timeMs: 118300,
      bestLapMs: 38450,
      date: Date.now() - 43200000,
    },
  ];
}

export function createDefaultSaveData(): SaveData {
  const customizations = {} as SaveData['customizations'];
  const upgrades = {} as SaveData['upgrades'];
  const damages = {} as SaveData['damages'];

  for (const car of CARS) {
    customizations[car.id] = createDefaultCustomization(car);
    upgrades[car.id] = createDefaultUpgrades();
    damages[car.id] = createDefaultDamage();
  }

  return {
    coins: 2200,
    selectedCar: 'bmw',
    unlockedCars: ['bmw'],
    customizations,
    upgrades,
    damages,
    highestLevelUnlocked: 1,
    selectedLevel: 1,
    settings: {
      quality: 'medium',
      speedUnit: 'kmh',
      engineVolume: 0.75,
      effectsVolume: 0.8,
      musicVolume: 0.4,
      showControlsHint: true,
      cameraSensitivity: 1.0,
    },
    dailyStreak: 0,
    lastDailyClaimDate: null,
    dailyMissionsDate: getTodayKey(),
    dailyMissions: generateDailyMissions(),
    achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
    leaderboard: createInitialLeaderboard(),
    tutorialSeen: false,
    totalRaces: 0,
    totalWins: 0,
    totalDriftMeters: 0,
  };
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSaveData();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const def = createDefaultSaveData();
    const today = getTodayKey();

    const merged: SaveData = {
      ...def,
      ...parsed,
      settings: { ...def.settings, ...(parsed.settings || {}) },
      customizations: { ...def.customizations, ...(parsed.customizations || {}) },
      upgrades: { ...def.upgrades, ...(parsed.upgrades || {}) },
      damages: { ...def.damages, ...(parsed.damages || {}) },
      dailyMissions:
        parsed.dailyMissionsDate === today && Array.isArray(parsed.dailyMissions)
          ? parsed.dailyMissions
          : generateDailyMissions(),
      dailyMissionsDate: today,
      achievements: def.achievements.map((base) => {
        const found = parsed.achievements?.find((a) => a.id === base.id);
        return found ? { ...base, ...found } : base;
      }),
      leaderboard:
        Array.isArray(parsed.leaderboard) && parsed.leaderboard.length > 0
          ? parsed.leaderboard
          : def.leaderboard,
    };

    // Ensure every car has valid sub-objects
    for (const car of CARS) {
      if (!merged.customizations[car.id]) {
        merged.customizations[car.id] = createDefaultCustomization(car);
      }
      if (!merged.upgrades[car.id]) {
        merged.upgrades[car.id] = createDefaultUpgrades();
      }
      if (!merged.damages[car.id]) {
        merged.damages[car.id] = createDefaultDamage();
      }
    }

    return merged;
  } catch {
    return createDefaultSaveData();
  }
}

export function persistSaveData(data: SaveData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function applyRaceResultToSave(
  prev: SaveData,
  result: RaceResult,
  weather: string
): { next: SaveData; newlyUnlockedAchievements: string[] } {
  const next: SaveData = {
    ...prev,
    coins: prev.coins + result.totalPointsEarned,
    totalRaces: prev.totalRaces + 1,
    totalWins: prev.totalWins + (result.position === 1 ? 1 : 0),
    totalDriftMeters: prev.totalDriftMeters + Math.round(result.driftMeters),
    highestLevelUnlocked:
      result.position <= 3
        ? Math.max(prev.highestLevelUnlocked, result.level + 1)
        : prev.highestLevelUnlocked,
    unlockedCars: [...prev.unlockedCars],
    damages: {
      ...prev.damages,
      [result.carId]: {
        body: Math.min(100, Math.round(prev.damages[result.carId].body + result.damageTaken.body)),
        engine: Math.min(100, Math.round(prev.damages[result.carId].engine + result.damageTaken.engine)),
        tires: Math.min(100, Math.round(prev.damages[result.carId].tires + result.damageTaken.tires)),
      },
    },
    dailyMissions: prev.dailyMissions.map((m) => {
      if (m.claimed) return m;
      let delta = 0;
      if (m.type === 'win_races' && result.position === 1) delta = 1;
      if (m.type === 'drift_meters') delta = Math.round(result.driftMeters);
      if (m.type === 'clean_finish') {
        const avgDmg =
          (result.damageTaken.body + result.damageTaken.engine + result.damageTaken.tires) / 3;
        if (avgDmg < 10) delta = 1;
      }
      return {
        ...m,
        progress: Math.min(m.target, m.progress + delta),
      };
    }),
    achievements: prev.achievements.map((a) => ({ ...a })),
    leaderboard: [...prev.leaderboard],
  };

  // Level 6 win unlocks the Apex-X Hypercar automatically!
  if (result.level >= 6 && result.position === 1 && !next.unlockedCars.includes('hypercar')) {
    next.unlockedCars.push('hypercar');
  }

  // Record player entry on leaderboard
  const carName = CAR_MAP[result.carId]?.name || result.carId;
  next.leaderboard.push({
    id: `race_${Date.now()}`,
    playerName: 'You (Player)',
    carId: result.carId,
    carName,
    biome: result.biome,
    level: result.level,
    timeMs: Math.round(result.raceTimeMs),
    bestLapMs: Math.round(result.bestLapMs || result.raceTimeMs),
    date: Date.now(),
  });
  next.leaderboard.sort((a, b) => a.timeMs - b.timeMs);
  next.leaderboard = next.leaderboard.slice(0, 20);

  // Check achievements
  const newlyUnlockedAchievements: string[] = [];
  const avgDmgThisRace =
    (result.damageTaken.body + result.damageTaken.engine + result.damageTaken.tires) / 3;

  for (const ach of next.achievements) {
    if (ach.unlocked) continue;
    let shouldUnlock = false;
    if (ach.id === 'first_win' && result.position === 1) shouldUnlock = true;
    if (ach.id === 'clean_sweep' && avgDmgThisRace < 5) shouldUnlock = true;
    if (ach.id === 'drift_king' && next.totalDriftMeters >= 1500) shouldUnlock = true;
    if (ach.id === 'rain_master' && result.position === 1 && (weather === 'rain' || weather === 'snow')) {
      shouldUnlock = true;
    }
    if (ach.id === 'collector' && next.unlockedCars.length >= 3) shouldUnlock = true;
    if (ach.id === 'hyper_champion' && result.level >= 6 && result.position === 1) {
      shouldUnlock = true;
    }

    if (shouldUnlock) {
      ach.unlocked = true;
      ach.unlockedAt = Date.now();
      next.coins += ach.reward;
      newlyUnlockedAchievements.push(ach.title);
    }
  }

  return { next, newlyUnlockedAchievements };
}

export const DAILY_REWARD_AMOUNTS = [500, 750, 1000, 1400, 1800, 2400, 4000];

export function canClaimDailyReward(save: SaveData): boolean {
  return save.lastDailyClaimDate !== getTodayKey();
}

export function getRepairCost(damage: { body: number; engine: number; tires: number }): number {
  const total = damage.body + damage.engine + damage.tires;
  if (total <= 0) return 0;
  return Math.max(60, Math.round(total * 3.5));
}

export function getUpgradeCost(level: number): number {
  return 450 + level * 400;
}

export function unlockItemKey(
  save: SaveData,
  carId: CarId,
  itemKey: string
): SaveData {
  const custom = save.customizations[carId];
  if (custom.unlockedItems.includes(itemKey)) return save;
  return {
    ...save,
    customizations: {
      ...save.customizations,
      [carId]: {
        ...custom,
        unlockedItems: [...custom.unlockedItems, itemKey],
      },
    },
  };
}
