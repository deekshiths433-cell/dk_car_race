import React, { useState } from 'react';
import { CheckCircle2, Coins, Eye, Film, Wrench, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { CAR_MAP } from '../data/cars';
import { showRewardedAd } from '../services/adSdk';
import { getRepairCost } from '../services/storage';
import { SaveData } from '../types/game';
import { ShowroomCanvas } from './ShowroomCanvas';

interface RepairShopModalProps {
  save: SaveData;
  onUpdateSave: (next: SaveData) => void;
  onClose: () => void;
}

export const RepairShopModal: React.FC<RepairShopModalProps> = ({
  save,
  onUpdateSave,
  onClose,
}) => {
  const [previewAfter, setPreviewAfter] = useState(false);
  const [adBusy, setAdBusy] = useState(false);

  const carId = save.selectedCar;
  const car = CAR_MAP[carId];
  const custom = save.customizations[carId];
  const damage = save.damages[carId];
  const avgDamage = Math.round((damage.body + damage.engine + damage.tires) / 3);
  const cost = getRepairCost(damage);

  const applyFullRepair = (free: boolean) => {
    if (avgDamage === 0) return;
    if (!free && save.coins < cost) return;
    soundEngine.triggerUiClick();
    onUpdateSave({
      ...save,
      coins: free ? save.coins : save.coins - cost,
      damages: {
        ...save.damages,
        [carId]: { body: 0, engine: 0, tires: 0 },
      },
    });
    setPreviewAfter(false);
  };

  const handleAdRepair = async () => {
    if (adBusy || avgDamage === 0) return;
    setAdBusy(true);
    const res = await showRewardedAd('repair_free', `Full Repair (${car.name})`);
    setAdBusy(false);
    if (res.completed) {
      applyFullRepair(true);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col lg:flex-row bg-[#080a0f]">
      {/* 3D Before / After Damage Preview */}
      <div className="relative flex-1 min-h-[38vh] lg:min-h-full">
        <ShowroomCanvas
          carId={carId}
          customization={custom}
          damage={previewAfter ? { body: 0, engine: 0, tires: 0 } : damage}
          interactive={true}
        />

        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="bg-[#0d111b]/92 border border-slate-800 rounded-lg px-4 py-2.5 pointer-events-auto">
            <div className="text-xs text-cyan-400 font-medium">Pit Lane Service</div>
            <div className="font-display text-lg font-bold text-white">{car.name}</div>
          </div>

          <div className="flex items-center gap-2 bg-[#0d111b]/92 border border-amber-500/40 rounded-lg px-3.5 py-2 pointer-events-auto">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono-num text-sm font-bold text-amber-300">
              {save.coins.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Before / After Toggle */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-[#0d111b]/95 border border-slate-700 rounded-lg">
          <button
            onClick={() => setPreviewAfter(false)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              !previewAfter
                ? 'bg-rose-500 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Before ({avgDamage}% Dmg)</span>
          </button>
          <button
            onClick={() => setPreviewAfter(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              previewAfter
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>After (0% Restored)</span>
          </button>
        </div>
      </div>

      {/* Right Diagnostics & Repair Actions */}
      <aside className="w-full lg:w-[420px] bg-[#0d111b] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-400" />
            <h2 className="font-display text-lg font-bold text-white">Repair Shop</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-5 overflow-y-auto dk-scroll">
          <div className="p-4 bg-[#121826] border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Overall Vehicle Condition</div>
              <div className="font-display text-2xl font-bold text-white mt-0.5">
                {100 - avgDamage}% Healthy
              </div>
            </div>
            <div
              className={`font-mono-num text-2xl font-bold ${
                avgDamage === 0
                  ? 'text-emerald-400'
                  : avgDamage < 35
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {avgDamage}% DMG
            </div>
          </div>

          <div className="space-y-3">
            {(
              [
                ['Body & Aero', damage.body, 'Scratches & panel dents increase drag'],
                ['Engine Bay', damage.engine, 'Reduces top speed & causes smoke above 35%'],
                ['Tires & Suspension', damage.tires, 'Reduces cornering grip & braking stability'],
              ] as const
            ).map(([label, val, hint]) => (
              <div
                key={label}
                className="p-3.5 bg-[#121826] border border-slate-800 rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white">{label}</span>
                  <span className="font-mono-num text-xs font-bold text-rose-400">
                    {val}% Damaged
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      val === 0 ? 'bg-emerald-500' : val < 40 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.max(4, 100 - val)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">{hint}</p>
              </div>
            ))}
          </div>

          {avgDamage === 0 ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-sm text-emerald-300 font-medium">
              Vehicle is in showroom condition. Ready for peak lap times!
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <button
                onClick={() => applyFullRepair(false)}
                disabled={save.coins < cost}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-sm rounded-lg transition-colors cursor-pointer"
              >
                Repair All Damage — {cost.toLocaleString()} PTS
              </button>

              <button
                onClick={handleAdRepair}
                disabled={adBusy}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-200 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
              >
                <Film className="w-4 h-4 text-cyan-300" />
                <span>Repair FREE (Watch Rewarded Ad)</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
