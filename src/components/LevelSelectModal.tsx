import React from 'react';
import { CloudRain, Lock, MapPin, Play, Snowflake, Sun, Sunset, Moon, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { BIOME_PALETTES, getLevelConfig } from '../data/tracks';
import { SaveData } from '../types/game';

interface LevelSelectModalProps {
  save: SaveData;
  onSelectLevel: (level: number, startImmediately?: boolean) => void;
  onClose: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  save,
  onSelectLevel,
  onClose,
}) => {
  const maxShow = Math.max(8, save.highestLevelUnlocked + 2);
  const levels = Array.from({ length: maxShow }, (_, i) => getLevelConfig(i + 1));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#06080d]/92 p-4 sm:p-6">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#0d111b] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Level & Circuit Select
            </h2>
            <p className="text-xs text-slate-400">
              Every race generates a fresh procedural track layout for the chosen biome
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 dk-scroll">
          {levels.map((lvl) => {
            const locked = lvl.level > save.highestLevelUnlocked;
            const selected = lvl.level === save.selectedLevel;
            const palette = BIOME_PALETTES[lvl.biome];

            return (
              <div
                key={lvl.level}
                className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                  selected
                    ? 'bg-amber-500/10 border-amber-500'
                    : locked
                    ? 'bg-[#0a0d15] border-slate-800/70 opacity-65'
                    : 'bg-[#121826] border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-400">
                      Level {lvl.level} · {palette.label}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      {lvl.timeOfDay === 'day' && <Sun className="w-3.5 h-3.5 text-amber-300" />}
                      {lvl.timeOfDay === 'sunset' && <Sunset className="w-3.5 h-3.5 text-orange-400" />}
                      {lvl.timeOfDay === 'night' && <Moon className="w-3.5 h-3.5 text-cyan-300" />}
                      {lvl.weather === 'rain' && <CloudRain className="w-3.5 h-3.5 text-sky-400" />}
                      {lvl.weather === 'snow' && <Snowflake className="w-3.5 h-3.5 text-blue-200" />}
                      <span className="capitalize">{lvl.weather}</span>
                    </div>
                  </div>

                  <h3 className="font-display text-lg font-bold text-white">
                    {lvl.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {lvl.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-3">
                  <div className="flex items-center gap-3 text-xs text-slate-300 font-mono-num">
                    <span>{lvl.laps} Laps</span>
                    <span>·</span>
                    <span>{lvl.aiCount} Rivals</span>
                    <span>·</span>
                    <span className="text-amber-300">1st: {lvl.rewardFirst} PTS</span>
                  </div>

                  {locked ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500">
                      <Lock className="w-3.5 h-3.5" />
                      Locked
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          soundEngine.triggerUiClick();
                          onSelectLevel(lvl.level, false);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800/70 text-slate-200 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 inline mr-1" />
                        {selected ? 'Selected' : 'Select'}
                      </button>
                      <button
                        onClick={() => {
                          soundEngine.triggerUiClick();
                          onSelectLevel(lvl.level, true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        Race
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
