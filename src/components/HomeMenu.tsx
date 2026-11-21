import React from 'react';
import {
  Award,
  CarFront,
  Coins,
  Gift,
  Map as MapIcon,
  Play,
  Settings,
  ShoppingBag,
  Wrench,
} from 'lucide-react';
import {
  CAR_MAP,
  formatSpeedValue,
  getEffectiveCarStats,
  getSpeedUnitLabel,
} from '../data/cars';
import { BIOME_PALETTES, getLevelConfig } from '../data/tracks';
import { canClaimDailyReward } from '../services/storage';
import { ActiveModal, SaveData } from '../types/game';
import { ShowroomCanvas } from './ShowroomCanvas';

interface HomeMenuProps {
  save: SaveData;
  onPlayRace: () => void;
  onOpenModal: (modal: ActiveModal) => void;
  onOpenTutorial: () => void;
}

export const HomeMenu: React.FC<HomeMenuProps> = ({
  save,
  onPlayRace,
  onOpenModal,
  onOpenTutorial,
}) => {
  const car = CAR_MAP[save.selectedCar];
  const custom = save.customizations[save.selectedCar];
  const upgrades = save.upgrades[save.selectedCar];
  const damage = save.damages[save.selectedCar];
  const eff = getEffectiveCarStats(car, upgrades, damage);
  const levelCfg = getLevelConfig(save.selectedLevel);
  const biome = BIOME_PALETTES[levelCfg.biome];
  const dailyReady = canClaimDailyReward(save);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#080a0f]">
      {/* Live 3D Showroom Backdrop */}
      <div className="absolute inset-0">
        <ShowroomCanvas
          carId={save.selectedCar}
          customization={custom}
          damage={damage}
          interactive={true}
          cameraShiftX={-0.6}
        />
      </div>

      {/* Subtle gradient scrim on left side for crisp text contrast */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#080a0f]/95 via-[#080a0f]/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#080a0f]/95 to-transparent" />

      {/* Top Strip: Brand Lockup & Points */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 pt-5 pb-3">
        <div className="flex items-center gap-3">
          {/* Bespoke SVG Brand Mark */}
          <svg
            width="44"
            height="34"
            viewBox="0 0 44 34"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <path
              d="M2 28L12 6H25L18 28H2Z"
              fill="#F59E0B"
            />
            <path
              d="M22 28L29 6H42L37 16L41 28H31L28 19L24 28H22Z"
              fill="#F8FAFC"
            />
          </svg>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-wider text-white whitespace-nowrap leading-none">
              DK CAR RACE
            </h1>
            <p className="text-xs text-slate-400 mt-1 whitespace-nowrap">
              {car.brand} · {biome.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenTutorial}
            className="hidden sm:inline-flex items-center px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#101521]/90 border border-slate-700/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Controls Guide
          </button>
          <div className="flex items-center gap-2 px-3.5 py-2 bg-[#101521]/95 border border-amber-500/40 rounded-lg">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-mono-num text-sm font-bold text-amber-300">
              {save.coins.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">PTS</span>
          </div>
        </div>
      </header>

      {/* Main Left Navigation + Selected Car Summary */}
      <main className="relative z-10 flex flex-col justify-between h-[calc(100%-96px)] px-5 sm:px-8 pb-5 pointer-events-none">
        <div className="my-auto max-w-md w-full space-y-5 pointer-events-auto">
          {/* Selected Supercar Summary */}
          <div className="bg-[#0d111b]/92 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-amber-400">
                  Selected Supercar
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5 leading-tight">
                  {car.name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{car.subtitle}</p>
              </div>
              {eff.damageAvg > 0 && (
                <button
                  onClick={() => onOpenModal('repair')}
                  className="px-2.5 py-1 text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-md hover:bg-rose-500/30 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {eff.damageAvg}% Damage
                </button>
              )}
            </div>

            {/* Clean tabular stat readouts */}
            <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-800/90">
              <div>
                <div className="text-[11px] text-slate-400">Top Speed</div>
                <div className="font-mono-num text-sm font-bold text-white">
                  {formatSpeedValue(eff.topSpeed, save.settings.speedUnit)}{' '}
                  <span className="text-[10px] text-slate-400">
                    {getSpeedUnitLabel(save.settings.speedUnit)}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">0-100 km/h</div>
                <div className="font-mono-num text-sm font-bold text-white">
                  {eff.zeroToHundred}s
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Gears</div>
                <div className="font-mono-num text-sm font-bold text-white">
                  {car.gears}-Spd
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Stage</div>
                <div className="font-mono-num text-sm font-bold text-cyan-300">
                  Lv.{levelCfg.level}
                </div>
              </div>
            </div>

            {/* Primary CTA */}
            <button
              onClick={onPlayRace}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display font-bold text-base tracking-wide rounded-lg transition-all cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>START RACE — {levelCfg.name}</span>
            </button>
          </div>

          {/* Menu Grid */}
          <nav
            aria-label="Main Menu"
            className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
          >
            <button
              onClick={() => onOpenModal('garage')}
              className="flex items-center gap-2.5 px-3.5 py-3 bg-[#101521]/92 hover:bg-[#171e2e] border border-slate-800 hover:border-amber-500/50 rounded-lg text-sm font-medium text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CarFront className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Garage</span>
            </button>

            <button
              onClick={() => onOpenModal('repair')}
              className="flex items-center justify-between gap-2 px-3.5 py-3 bg-[#101521]/92 hover:bg-[#171e2e] border border-slate-800 hover:border-amber-500/50 rounded-lg text-sm font-medium text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Repair Shop</span>
              </span>
              {eff.damageAvg > 0 && (
                <span className="font-mono-num text-xs text-rose-400">
                  {eff.damageAvg}%
                </span>
              )}
            </button>

            <button
              onClick={() => onOpenModal('levels')}
              className="flex items-center gap-2.5 px-3.5 py-3 bg-[#101521]/92 hover:bg-[#171e2e] border border-slate-800 hover:border-amber-500/50 rounded-lg text-sm font-medium text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <MapIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Level Select</span>
            </button>

            <button
              onClick={() => onOpenModal('shop')}
              className="flex items-center gap-2.5 px-3.5 py-3 bg-[#101521]/92 hover:bg-[#171e2e] border border-slate-800 hover:border-amber-500/50 rounded-lg text-sm font-medium text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4 text-violet-400 shrink-0" />
              <span>Car Shop</span>
            </button>

            <button
              onClick={() => onOpenModal('extras')}
              className="flex items-center justify-between gap-2 px-3.5 py-3 bg-[#101521]/92 hover:bg-[#171e2e] border border-slate-800 hover:border-amber-500/50 rounded-lg text-sm font-medium text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="flex items-center gap-2">
                {dailyReady ? (
                  <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>Daily & Ranks</span>
              </span>
              {dailyReady && (
                <span className="text-[11px] font-semibold text-amber-400">
                  Claim
                </span>
              )}
            </button>

            <button
              onClick={() => onOpenModal('settings')}
              className="flex items-center gap-2.5 px-3.5 py-3 bg-[#101521]/92 hover:bg-[#171e2e] border border-slate-800 hover:border-amber-500/50 rounded-lg text-sm font-medium text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-4 h-4 text-slate-300 shrink-0" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Single Flat Control Hint Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-2">
          <span>
            WASD Drive · Shift Nitro · Space Handbrake · L Lights · Q/E Indicators · C Camera · R Reset · Esc Pause
          </span>
          <span className="hidden md:inline text-slate-500">
            Drag showroom to rotate 3D preview
          </span>
        </div>
      </main>
    </div>
  );
};
