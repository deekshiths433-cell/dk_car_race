import React, { useState } from 'react';
import { Check, Coins, Lock, ShoppingBag, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import {
  CARS,
  CAR_MAP,
  formatSpeedValue,
  getEffectiveCarStats,
  getSpeedUnitLabel,
} from '../data/cars';
import { CarId, SaveData } from '../types/game';
import { ShowroomCanvas } from './ShowroomCanvas';

interface ShopModalProps {
  save: SaveData;
  onUpdateSave: (next: SaveData) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  save,
  onUpdateSave,
  onClose,
}) => {
  const [inspectId, setInspectId] = useState<CarId>(save.selectedCar);
  const spec = CAR_MAP[inspectId];
  const owned = save.unlockedCars.includes(inspectId);
  const selected = save.selectedCar === inspectId;
  const eff = getEffectiveCarStats(
    spec,
    save.upgrades[inspectId],
    save.damages[inspectId]
  );

  const handleBuyOrSelect = () => {
    soundEngine.triggerUiClick();
    if (owned) {
      onUpdateSave({ ...save, selectedCar: inspectId });
      return;
    }
    if (save.coins < spec.price) return;
    onUpdateSave({
      ...save,
      coins: save.coins - spec.price,
      unlockedCars: [...save.unlockedCars, inspectId],
      selectedCar: inspectId,
    });
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col lg:flex-row bg-[#080a0f]">
      {/* Left 3D Dealership Preview */}
      <div className="relative flex-1 min-h-[38vh] lg:min-h-full">
        <ShowroomCanvas
          carId={inspectId}
          customization={save.customizations[inspectId]}
          damage={save.damages[inspectId]}
          interactive={true}
        />

        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="bg-[#0d111b]/92 border border-slate-800 rounded-lg px-4 py-2.5 pointer-events-auto">
            <div className="text-xs text-amber-400 font-medium">
              {spec.isHypercar ? 'Unlockable Hypercar' : spec.brand}
            </div>
            <div className="font-display text-xl font-bold text-white">{spec.name}</div>
            <div className="text-xs text-slate-400">{spec.subtitle}</div>
          </div>

          <div className="flex items-center gap-2 bg-[#0d111b]/92 border border-amber-500/40 rounded-lg px-3.5 py-2 pointer-events-auto">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono-num text-sm font-bold text-amber-300">
              {save.coins.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Right Dealership Catalog */}
      <aside className="w-full lg:w-[440px] h-[62vh] lg:h-full bg-[#0d111b] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-violet-400" />
            <h2 className="font-display text-lg font-bold text-white">Supercar Dealership</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3 dk-scroll">
          {CARS.map((c) => {
            const isOwned = save.unlockedCars.includes(c.id);
            const isInspecting = inspectId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  soundEngine.triggerUiClick();
                  setInspectId(c.id);
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                  isInspecting
                    ? 'bg-amber-500/15 border-amber-500'
                    : 'bg-[#121826] border-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm text-white">
                      {c.name}
                    </span>
                    {c.isHypercar && (
                      <span className="text-[11px] font-semibold text-emerald-400">
                        Hypercar
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {formatSpeedValue(c.stats.topSpeed, save.settings.speedUnit)}{' '}
                    {getSpeedUnitLabel(save.settings.speedUnit)} · 0-100 in{' '}
                    {c.stats.zeroToHundred}s · {c.stats.weight} kg
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {isOwned ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                      {save.selectedCar === c.id ? 'Active' : 'Owned'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono-num text-xs font-bold text-amber-300">
                      <Lock className="w-3 h-3" />
                      {c.price.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Car Spec Breakdown & Purchase CTA */}
        <div className="p-5 bg-[#0a0d16] border-t border-slate-800 space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[11px] text-slate-400">
                Top ({getSpeedUnitLabel(save.settings.speedUnit)})
              </div>
              <div className="font-mono-num text-sm font-bold text-white">
                {formatSpeedValue(eff.topSpeed, save.settings.speedUnit)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">0-100</div>
              <div className="font-mono-num text-sm font-bold text-white">
                {eff.zeroToHundred}s
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Gears</div>
              <div className="font-mono-num text-sm font-bold text-white">
                {spec.gears}-Spd
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Weight</div>
              <div className="font-mono-num text-sm font-bold text-white">{eff.weight}kg</div>
            </div>
          </div>

          {spec.unlockNote && !owned && (
            <p className="text-xs text-emerald-400 text-center">{spec.unlockNote}</p>
          )}

          <button
            onClick={handleBuyOrSelect}
            disabled={(!owned && save.coins < spec.price) || selected}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-sm rounded-lg transition-colors cursor-pointer"
          >
            {selected
              ? 'Currently Selected'
              : owned
              ? 'Drive This Car'
              : `Buy Supercar — ${spec.price.toLocaleString()} PTS`}
          </button>
        </div>
      </aside>
    </div>
  );
};
