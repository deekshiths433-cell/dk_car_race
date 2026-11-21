import React, { useState } from 'react';
import { Award, Check, Gift, Target, Trophy, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { BIOME_PALETTES } from '../data/tracks';
import {
  canClaimDailyReward,
  DAILY_REWARD_AMOUNTS,
  getTodayKey,
} from '../services/storage';
import { SaveData } from '../types/game';

interface ExtrasModalProps {
  save: SaveData;
  onUpdateSave: (next: SaveData) => void;
  onClose: () => void;
}

type ExtrasTab = 'daily' | 'missions' | 'achievements' | 'leaderboard';

function formatMs(ms: number): string {
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(hundredths).padStart(2, '0')}`;
}

export const ExtrasModal: React.FC<ExtrasModalProps> = ({
  save,
  onUpdateSave,
  onClose,
}) => {
  const [tab, setTab] = useState<ExtrasTab>('daily');
  const canClaim = canClaimDailyReward(save);
  const currentDayIdx = save.dailyStreak % DAILY_REWARD_AMOUNTS.length;

  const claimDaily = () => {
    if (!canClaim) return;
    soundEngine.triggerUiClick();
    const reward = DAILY_REWARD_AMOUNTS[currentDayIdx];
    onUpdateSave({
      ...save,
      coins: save.coins + reward,
      dailyStreak: save.dailyStreak + 1,
      lastDailyClaimDate: getTodayKey(),
    });
  };

  const claimMission = (id: string) => {
    const target = save.dailyMissions.find((m) => m.id === id);
    if (!target || target.claimed || target.progress < target.target) return;
    soundEngine.triggerUiClick();
    onUpdateSave({
      ...save,
      coins: save.coins + target.reward,
      dailyMissions: save.dailyMissions.map((m) =>
        m.id === id ? { ...m, claimed: true } : m
      ),
    });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#06080d]/92 p-4 sm:p-6">
      <div className="w-full max-w-4xl max-h-[88vh] bg-[#0d111b] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-display text-xl font-bold text-white">
            Rewards, Missions & Leaderboard
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-[#090c14] border-b border-slate-800">
          {(
            [
              ['daily', 'Daily Rewards', Gift],
              ['missions', 'Missions', Target],
              ['achievements', 'Trophies', Award],
              ['leaderboard', 'Leaderboard', Trophy],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-2 py-2.5 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                tab === id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 dk-scroll">
          {tab === 'daily' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    7-Day Login Streak
                  </h3>
                  <p className="text-xs text-slate-400">
                    Current streak: {save.dailyStreak} day(s)
                  </p>
                </div>
                <button
                  onClick={claimDaily}
                  disabled={!canClaim}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-sm rounded-lg cursor-pointer"
                >
                  {canClaim
                    ? `Claim Day ${currentDayIdx + 1} (+${DAILY_REWARD_AMOUNTS[currentDayIdx]} PTS)`
                    : 'Claimed Today'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {DAILY_REWARD_AMOUNTS.map((amt, idx) => {
                  const claimed = idx < currentDayIdx || (idx === currentDayIdx && !canClaim);
                  const isToday = idx === currentDayIdx && canClaim;
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-center space-y-1.5 ${
                        isToday
                          ? 'bg-amber-500/15 border-amber-500'
                          : claimed
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-[#121826] border-slate-800'
                      }`}
                    >
                      <div className="text-xs text-slate-400">Day {idx + 1}</div>
                      <div className="font-mono-num text-base font-bold text-amber-300">
                        +{amt}
                      </div>
                      <div className="text-[11px] font-semibold">
                        {claimed ? (
                          <span className="text-emerald-400 inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> Claimed
                          </span>
                        ) : isToday ? (
                          <span className="text-amber-400">Ready</span>
                        ) : (
                          <span className="text-slate-500">Upcoming</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'missions' && (
            <div className="space-y-3">
              {save.dailyMissions.map((m) => {
                const done = m.progress >= m.target;
                return (
                  <div
                    key={m.id}
                    className="p-4 bg-[#121826] border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-white">{m.title}</span>
                        <span className="font-mono-num text-xs text-slate-300">
                          {m.progress} / {m.target}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{m.description}</p>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400"
                          style={{
                            width: `${Math.min(100, (m.progress / m.target) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => claimMission(m.id)}
                      disabled={!done || m.claimed}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 cursor-pointer whitespace-nowrap"
                    >
                      {m.claimed ? 'Claimed' : done ? `Claim +${m.reward}` : `+${m.reward} PTS`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'achievements' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {save.achievements.map((a) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-xl border space-y-1.5 ${
                    a.unlocked
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-[#121826] border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm text-white">
                      {a.title}
                    </span>
                    <span
                      className={`font-mono-num text-xs font-semibold ${
                        a.unlocked ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {a.unlocked ? 'Unlocked' : `+${a.reward} PTS`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{a.description}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'leaderboard' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 pr-3">Rank</th>
                    <th className="py-2.5 pr-3">Driver</th>
                    <th className="py-2.5 pr-3">Supercar</th>
                    <th className="py-2.5 pr-3">Circuit</th>
                    <th className="py-2.5 pr-3 text-right">Best Lap</th>
                    <th className="py-2.5 text-right">Race Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {save.leaderboard.map((entry, idx) => (
                    <tr key={entry.id} className="text-slate-200">
                      <td className="py-2.5 pr-3 font-mono-num font-bold text-amber-400">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 pr-3 font-medium">{entry.playerName}</td>
                      <td className="py-2.5 pr-3 text-slate-300">{entry.carName}</td>
                      <td className="py-2.5 pr-3 text-slate-400">
                        Lv.{entry.level} · {BIOME_PALETTES[entry.biome]?.label || entry.biome}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono-num text-cyan-300">
                        {formatMs(entry.bestLapMs)}
                      </td>
                      <td className="py-2.5 text-right font-mono-num font-bold">
                        {formatMs(entry.timeMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
