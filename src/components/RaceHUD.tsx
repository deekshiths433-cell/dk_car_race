import React from 'react';
import {
  Camera,
  CloudRain,
  Flame,
  Home,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  Wrench,
} from 'lucide-react';
import {
  CAR_MAP,
  formatSpeedValue,
  getSpeedUnitLabel,
} from '../data/cars';
import { BIOME_PALETTES } from '../data/tracks';
import {
  GameSettings,
  RaceResult,
  RaceTelemetry,
} from '../types/game';

interface RaceHUDProps {
  telemetry: RaceTelemetry;
  settings: GameSettings;
  paused: boolean;
  result: RaceResult | null;
  newlyUnlockedAchievements: string[];
  onPauseToggle: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onOpenSettings: () => void;
  onOpenGarage: () => void;
  onGoHome: () => void;
  onCycleLights: () => void;
  onCycleCamera: () => void;
  onToggleIndicator: (side: 'left' | 'right') => void;
  onToggleHazard: () => void;
  onToggleWipers: () => void;
  onResetCar: () => void;
  onTouchInput: (
    partial: Partial<{
      throttle: number;
      brake: number;
      steer: number;
      handbrake: boolean;
      nitro: boolean;
    }>,
    horn?: boolean
  ) => void;
}

function formatRaceTime(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const tenths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(tenths).padStart(2, '0')}`;
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  telemetry,
  settings,
  paused,
  result,
  newlyUnlockedAchievements,
  onPauseToggle,
  onRestart,
  onNextLevel,
  onOpenSettings,
  onOpenGarage,
  onGoHome,
  onCycleLights,
  onCycleCamera,
  onToggleIndicator,
  onToggleHazard,
  onToggleWipers,
  onResetCar,
  onTouchInput,
}) => {
  const rpmPct = Math.min(100, Math.round((telemetry.rpm / telemetry.maxRpm) * 100));
  const showSpeedLines = telemetry.speedKmh > 210 || telemetry.isBoosting;

  // Minimap SVG polyline string
  const polyPoints = telemetry.minimapPoints
    .map((pt) => `${(pt.x * 110).toFixed(1)},${(pt.y * 110).toFixed(1)}`)
    .join(' ');

  const controlHintText =
    telemetry.activeInput === 'gamepad'
      ? 'RT Accel · LT Brake · Left Stick Steer · A Nitro · B Handbrake · Y Horn · Esc Pause'
      : telemetry.activeInput === 'touch'
      ? 'Touch Pedals & Steer · Nitro Boost · Handbrake · Tap Feature Icons'
      : 'W Accel · S Brake · A/D Steer · Shift Nitro · Space Handbrake · H Horn · L Lights · Q/E/Z Signals · C Cam · R Reset · Esc Pause';

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Speed Motion Radial Vignette at High Velocity */}
      {showSpeedLines && !paused && !result && (
        <div
          className="pointer-events-none fixed inset-0 transition-opacity duration-200"
          style={{
            background:
              'radial-gradient(circle at center, transparent 58%, rgba(6, 182, 212, 0.14) 100%)',
          }}
        />
      )}

      {/* TOP BAR: Position/Lap/Time (Left) | Live Rear-View Mirror Frame (Center) | Minimap + Pause (Right) */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Race Status */}
        <div className="bg-[#0a0d14]/88 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-4 pointer-events-auto">
          <div>
            <div className="text-[10px] text-slate-400">POS</div>
            <div className="font-display text-2xl font-extrabold text-amber-400 leading-none font-mono-num">
              {telemetry.position}
              <span className="text-xs text-slate-400 font-normal">/{telemetry.totalRacers}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-400">LAP</div>
            <div className="font-display text-xl font-bold text-white leading-none font-mono-num">
              {telemetry.lap}
              <span className="text-xs text-slate-400 font-normal">/{telemetry.totalLaps}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="hidden sm:block">
            <div className="text-[10px] text-slate-400">TIME</div>
            <div className="font-mono-num text-sm font-bold text-slate-100">
              {formatRaceTime(telemetry.raceTimeMs)}
            </div>
          </div>
        </div>

        {/* Top-Center Rear-View Mirror Bezel (frames the live WebGL scissor viewport) */}
        {telemetry.cameraMode !== 'cinematic' && settings.quality !== 'low' && (
          <div className="hidden md:flex flex-col items-center">
            <div
              className="border-2 border-slate-700/90 rounded-md shadow-lg"
              style={{
                width: 'min(240px, 22vw)',
                height: 'calc(min(240px, 22vw) * 0.28)',
              }}
            />
            <span className="text-[10px] text-slate-400 mt-1">
              Rear Mirror · {telemetry.cameraMode.toUpperCase()}
            </span>
          </div>
        )}

        {/* Top-Right Minimap & Pause */}
        <div className="flex items-start gap-2.5 pointer-events-auto">
          <div className="bg-[#0a0d14]/88 border border-slate-800 rounded-xl p-2 hidden sm:block">
            <svg width="110" height="110" viewBox="0 0 110 110">
              {polyPoints && (
                <polygon
                  points={polyPoints}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="5"
                  strokeLinejoin="round"
                />
              )}
              {telemetry.minimapRacers.map((r, i) => (
                <circle
                  key={i}
                  cx={r.x * 110}
                  cy={r.y * 110}
                  r={r.isPlayer ? 4.2 : 3}
                  fill={r.isPlayer ? '#f59e0b' : r.color}
                  stroke="#080a0f"
                  strokeWidth="1"
                />
              ))}
            </svg>
          </div>

          <button
            onClick={onPauseToggle}
            className="p-3 bg-[#0a0d14]/90 hover:bg-[#141b29] border border-slate-700 rounded-xl text-white cursor-pointer"
            aria-label="Pause Race"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CENTER NOTIFICATIONS: Countdown, Wrong Way, Drift Score */}
      <div className="flex flex-col items-center justify-center gap-3 my-auto">
        {telemetry.countdownValue >= 0 && (
          <div className="font-display text-6xl sm:text-8xl font-extrabold tracking-wider text-amber-400 drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
            {telemetry.countdownValue === 0 ? 'GO!' : telemetry.countdownValue}
          </div>
        )}

        {telemetry.wrongWay && (
          <div className="px-5 py-2 bg-rose-600/95 border border-rose-300 rounded-lg font-display font-bold text-lg text-white">
            WRONG WAY — Press R to Reset
          </div>
        )}

        {telemetry.isDrifting && telemetry.countdownValue < 0 && (
          <div className="px-4 py-1.5 bg-[#0a0d14]/88 border border-cyan-500/50 rounded-lg text-xs font-bold text-cyan-300 font-mono-num">
            DRIFT · {telemetry.driftScore.toLocaleString()} PTS
          </div>
        )}
      </div>

      {/* BOTTOM AREA: Car Feature Toggles, Speedometer/Gear/Nitro, Mobile Touch Controls, Hint Bar */}
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          {/* Bottom-Left: Car Feature Toggles + Mobile Steering */}
          <div className="flex flex-col gap-2 pointer-events-auto">
            <div className="flex flex-wrap items-center gap-1.5 bg-[#0a0d14]/88 border border-slate-800 rounded-xl p-1.5">
              <button
                onClick={onCycleLights}
                title="Headlights (L)"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                  telemetry.headlights !== 'off'
                    ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span className="uppercase">{telemetry.headlights}</span>
              </button>

              <button
                onClick={() => onToggleIndicator('left')}
                title="Left Signal (Q)"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  telemetry.indicators === 'left' || telemetry.indicators === 'hazard'
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ◀
              </button>

              <button
                onClick={onToggleHazard}
                title="Hazard Lights (Z)"
                className={`px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  telemetry.indicators === 'hazard'
                    ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ▲
              </button>

              <button
                onClick={() => onToggleIndicator('right')}
                title="Right Signal (E)"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  telemetry.indicators === 'right' || telemetry.indicators === 'hazard'
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ▶
              </button>

              <button
                onClick={onToggleWipers}
                title="Wipers (V)"
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  telemetry.wipersOn
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onCycleCamera}
                title="Camera View (C)"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline capitalize">{telemetry.cameraMode}</span>
              </button>

              <button
                onClick={onResetCar}
                title="Reset Car (R)"
                className="px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onPointerDown={() => onTouchInput({}, true)}
                onPointerUp={() => onTouchInput({}, false)}
                onPointerLeave={() => onTouchInput({}, false)}
                title="Horn (H)"
                className="px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile Left/Right Touch Steering */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onPointerDown={() => onTouchInput({ steer: 1 })}
                onPointerUp={() => onTouchInput({ steer: 0 })}
                onPointerCancel={() => onTouchInput({ steer: 0 })}
                onPointerLeave={() => onTouchInput({ steer: 0 })}
                className="w-16 h-14 bg-[#0d111b]/90 active:bg-amber-500 active:text-slate-950 border border-slate-700 rounded-xl font-display font-bold text-xl text-white"
              >
                ◀
              </button>
              <button
                onPointerDown={() => onTouchInput({ steer: -1 })}
                onPointerUp={() => onTouchInput({ steer: 0 })}
                onPointerCancel={() => onTouchInput({ steer: 0 })}
                onPointerLeave={() => onTouchInput({ steer: 0 })}
                className="w-16 h-14 bg-[#0d111b]/90 active:bg-amber-500 active:text-slate-950 border border-slate-700 rounded-xl font-display font-bold text-xl text-white"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Bottom-Right: Digital Tachometer, Gear, Speedometer, Nitro + Mobile Pedals */}
          <div className="flex flex-col items-end gap-2 pointer-events-auto">
            {/* Mobile Touch Pedals & Nitro */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onPointerDown={() => onTouchInput({ nitro: true })}
                onPointerUp={() => onTouchInput({ nitro: false })}
                onPointerCancel={() => onTouchInput({ nitro: false })}
                className="px-3.5 h-12 bg-cyan-500/25 active:bg-cyan-400 border border-cyan-500/50 rounded-xl text-xs font-bold text-cyan-200"
              >
                NITRO
              </button>
              <button
                onPointerDown={() => onTouchInput({ handbrake: true })}
                onPointerUp={() => onTouchInput({ handbrake: false })}
                onPointerCancel={() => onTouchInput({ handbrake: false })}
                className="px-3 h-12 bg-rose-500/25 active:bg-rose-500 border border-rose-500/50 rounded-xl text-xs font-bold text-rose-200"
              >
                DRIFT
              </button>
              <button
                onPointerDown={() => onTouchInput({ brake: 1 })}
                onPointerUp={() => onTouchInput({ brake: 0 })}
                onPointerCancel={() => onTouchInput({ brake: 0 })}
                className="w-14 h-14 bg-[#0d111b]/90 active:bg-rose-500 border border-slate-700 rounded-xl text-xs font-bold text-white"
              >
                BRK
              </button>
              <button
                onPointerDown={() => onTouchInput({ throttle: 1 })}
                onPointerUp={() => onTouchInput({ throttle: 0 })}
                onPointerCancel={() => onTouchInput({ throttle: 0 })}
                className="w-16 h-14 bg-amber-500 active:bg-amber-400 border border-amber-400 rounded-xl text-xs font-extrabold text-slate-950"
              >
                GAS
              </button>
            </div>

            {/* Speedometer & Gear Cluster */}
            <div className="bg-[#0a0d14]/90 border border-slate-800 rounded-xl px-4 py-3 min-w-[235px] space-y-2">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="font-mono-num text-3xl sm:text-4xl font-extrabold text-white leading-none">
                    {formatSpeedValue(telemetry.speedKmh, settings.speedUnit)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {getSpeedUnitLabel(settings.speedUnit)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400">
                    GEAR ({telemetry.totalGears})
                  </div>
                  <div className="font-display text-2xl font-extrabold text-amber-400 leading-none">
                    {telemetry.gear}
                  </div>
                </div>
              </div>

              {/* RPM Bar & Live Readout */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono-num">
                  <span className="text-slate-400">{telemetry.rpm.toLocaleString()} RPM</span>
                  <span
                    className={
                      telemetry.rpm >= telemetry.redlineRpm
                        ? 'text-rose-400 font-bold'
                        : 'text-slate-500'
                    }
                  >
                    RED {telemetry.redlineRpm.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      telemetry.rpm >= telemetry.redlineRpm
                        ? 'bg-rose-500'
                        : rpmPct > 72
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${rpmPct}%` }}
                  />
                </div>
              </div>

              {/* Nitro & Damage */}
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-1.5 flex-1">
                  <Flame className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400"
                      style={{ width: `${telemetry.nitro}%` }}
                    />
                  </div>
                </div>
                <span
                  className={`font-mono-num font-semibold ${
                    telemetry.damageAvg > 35 ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  DMG {telemetry.damageAvg}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Adaptive Controls Hint Bar */}
        {settings.showControlsHint && (
          <div className="hidden sm:block text-center text-[11px] text-slate-300 bg-[#0a0d14]/82 border border-slate-800/80 rounded-lg px-3 py-1.5 mx-auto w-fit">
            {controlHintText}
          </div>
        )}
      </div>

      {/* PAUSE MODAL */}
      {paused && !result && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#06080d]/88 p-4">
          <div className="w-full max-w-sm bg-[#0d111b] border border-slate-800 rounded-xl p-6 space-y-4 text-center">
            <h2 className="font-display text-2xl font-bold text-white">Race Paused</h2>
            <div className="space-y-2.5 pt-2">
              <button
                onClick={onPauseToggle}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Resume Race</span>
              </button>
              <button
                onClick={onRestart}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#141b29] hover:bg-slate-800 border border-slate-700 text-white font-semibold text-sm rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Stage</span>
              </button>
              <button
                onClick={onOpenSettings}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#141b29] hover:bg-slate-800 border border-slate-700 text-white font-semibold text-sm rounded-lg cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <button
                onClick={onGoHome}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#141b29] hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm rounded-lg cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Home Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS MODAL */}
      {result && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#06080d]/90 p-4">
          <div className="w-full max-w-md bg-[#0d111b] border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="text-xs font-semibold text-amber-400">
                Level {result.level} · {BIOME_PALETTES[result.biome].label}
              </div>
              <h2 className="font-display text-3xl font-extrabold text-white">
                {result.position === 1
                  ? '1st Place — Victory!'
                  : result.position === 2
                  ? '2nd Place — Podium!'
                  : result.position === 3
                  ? '3rd Place — Podium!'
                  : `Finished ${result.position}th`}
              </h2>
              <p className="text-xs text-slate-400">
                {CAR_MAP[result.carId].name} · Time {formatRaceTime(result.raceTimeMs)}
              </p>
            </div>

            <div className="p-4 bg-[#121826] border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Position Reward</span>
                <span className="font-mono-num text-white">+{result.baseReward} PTS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Clean Driving Bonus</span>
                <span className="font-mono-num text-emerald-400">
                  +{result.cleanDrivingBonus} PTS
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Drift Style Bonus ({result.driftMeters}m)</span>
                <span className="font-mono-num text-cyan-400">+{result.driftBonus} PTS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nitro Efficiency</span>
                <span className="font-mono-num text-sky-400">+{result.nitroBonus} PTS</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold">
                <span className="text-white">Total Earned</span>
                <span className="font-mono-num text-amber-400">
                  +{result.totalPointsEarned.toLocaleString()} PTS
                </span>
              </div>
            </div>

            {newlyUnlockedAchievements.length > 0 && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 text-center font-semibold">
                Achievement Unlocked: {newlyUnlockedAchievements.join(', ')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={onNextLevel}
                className="col-span-2 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg cursor-pointer"
              >
                Next Level (Stage {result.level + 1})
              </button>
              <button
                onClick={onRestart}
                className="py-2.5 bg-[#141b29] hover:bg-slate-800 border border-slate-700 text-white font-semibold text-xs rounded-lg cursor-pointer"
              >
                Retry Stage
              </button>
              <button
                onClick={onOpenGarage}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-[#141b29] hover:bg-slate-800 border border-slate-700 text-white font-semibold text-xs rounded-lg cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>Garage</span>
              </button>
              <button
                onClick={onGoHome}
                className="col-span-2 py-2.5 bg-[#090c14] hover:bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
              >
                Back to Home Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
