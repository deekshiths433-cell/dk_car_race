import React, { useState } from 'react';
import { RotateCcw, Settings, Volume2, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { GameSettings, QualityLevel } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onResetSave?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChange,
  onResetSave,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const update = (partial: Partial<GameSettings>) => {
    const next = { ...settings, ...partial };
    onChange(next);
    soundEngine.applySettings(next);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080d]/92 p-4">
      <div className="w-full max-w-lg bg-[#0d111b] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-white">Game Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto dk-scroll">
          {/* Graphics Quality */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Graphics Quality
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-[#080b12] border border-slate-800 rounded-lg">
              {(['low', 'medium', 'high'] as QualityLevel[]).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    soundEngine.triggerUiClick();
                    update({ quality: q });
                  }}
                  className={`py-2 text-xs font-semibold capitalize rounded-md transition-colors cursor-pointer ${
                    settings.quality === q
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Controls shadow resolution, particle density, pixel ratio, and live rear mirror rendering.
            </p>
          </div>

          {/* Speedometer Unit */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Speedometer Unit
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#080b12] border border-slate-800 rounded-lg">
              {(
                [
                  ['kmh', 'KM/H (Metric)'],
                  ['mph', 'MPH (Imperial)'],
                ] as const
              ).map(([unit, label]) => (
                <button
                  key={unit}
                  onClick={() => {
                    soundEngine.triggerUiClick();
                    update({ speedUnit: unit });
                  }}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    settings.speedUnit === unit
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Sliders */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Audio Mix</span>
            </div>

            {(
              [
                ['engineVolume', 'Engine & Exhaust'],
                ['effectsVolume', 'Tires, Crashes & Horn'],
                ['musicVolume', 'Race Synth Music'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">{label}</span>
                  <span className="font-mono-num text-amber-300">
                    {Math.round(settings[key] * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings[key]}
                  onChange={(e) => update({ [key]: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            ))}
          </div>

          {/* Camera Sensitivity */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Camera Follow Responsiveness</span>
              <span className="font-mono-num text-amber-300">
                {settings.cameraSensitivity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={settings.cameraSensitivity}
              onChange={(e) =>
                update({ cameraSensitivity: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Controls Hint Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-[#121826] border border-slate-800 rounded-lg">
            <div>
              <div className="text-sm font-semibold text-white">
                Show On-Screen Controls Guide
              </div>
              <div className="text-xs text-slate-400">
                Displays adaptive hints for Keyboard, Touch, or Gamepad
              </div>
            </div>
            <button
              onClick={() => update({ showControlsHint: !settings.showControlsHint })}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                settings.showControlsHint
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {settings.showControlsHint ? 'Shown' : 'Hidden'}
            </button>
          </div>

          {onResetSave && (
            <div className="pt-2 border-t border-slate-800">
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="flex items-center gap-2 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Saved Progress</span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3 bg-rose-500/10 border border-rose-500/40 rounded-lg">
                  <span className="text-xs text-rose-200">
                    Erase all cars, points, and records?
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="px-2.5 py-1 text-xs bg-slate-800 text-slate-200 rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setConfirmReset(false);
                        onResetSave();
                      }}
                      className="px-2.5 py-1 text-xs bg-rose-600 text-white font-semibold rounded cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
