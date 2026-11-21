import React, { useState } from 'react';
import { Check, Coins, Film, Gauge, Palette, Sparkles, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import {
  CAR_MAP,
  formatSpeedValue,
  getEffectiveCarStats,
  getSpeedUnitLabel,
} from '../data/cars';
import {
  BODYKIT_STYLES,
  CALIPER_COLORS,
  PAINT_FINISHES,
  PAINT_SWATCHES,
  RIM_STYLES,
  SPOILER_STYLES,
  TIRE_STYLES,
  UNDERGLOW_COLORS,
  WINDOW_TINTS,
} from '../data/tracks';
import { showRewardedAd } from '../services/adSdk';
import { getUpgradeCost } from '../services/storage';
import { CarCustomization, CarId, CarUpgrades, SaveData } from '../types/game';
import { ShowroomCanvas } from './ShowroomCanvas';

interface GarageModalProps {
  save: SaveData;
  onUpdateSave: (next: SaveData) => void;
  onClose: () => void;
}

type GarageTab = 'paint' | 'wheels' | 'aero' | 'performance';

export const GarageModal: React.FC<GarageModalProps> = ({
  save,
  onUpdateSave,
  onClose,
}) => {
  const [tab, setTab] = useState<GarageTab>('paint');
  const [adBusy, setAdBusy] = useState(false);

  const carId: CarId = save.selectedCar;
  const car = CAR_MAP[carId];
  const custom = save.customizations[carId];
  const upgrades = save.upgrades[carId];
  const damage = save.damages[carId];
  const eff = getEffectiveCarStats(car, upgrades, damage);

  const isUnlocked = (key: string) => custom.unlockedItems.includes(key);

  const applyCustomization = (
    field: keyof Omit<CarCustomization, 'unlockedItems'>,
    value: string,
    price: number,
    label: string
  ) => {
    const key = `${field}:${value}`;
    soundEngine.triggerUiClick();

    if (isUnlocked(key) || price === 0) {
      onUpdateSave({
        ...save,
        customizations: {
          ...save.customizations,
          [carId]: {
            ...custom,
            [field]: value,
            unlockedItems: isUnlocked(key)
              ? custom.unlockedItems
              : [...custom.unlockedItems, key],
          },
        },
      });
      return;
    }

    if (save.coins < price) return;
    onUpdateSave({
      ...save,
      coins: save.coins - price,
      customizations: {
        ...save.customizations,
        [carId]: {
          ...custom,
          [field]: value,
          unlockedItems: [...custom.unlockedItems, key],
        },
      },
    });
    void label;
  };

  const unlockViaAd = async (
    field: keyof Omit<CarCustomization, 'unlockedItems'>,
    value: string,
    label: string
  ) => {
    if (adBusy) return;
    setAdBusy(true);
    const res = await showRewardedAd('garage_unlock_item', label);
    setAdBusy(false);
    if (!res.completed) return;

    const key = `${field}:${value}`;
    onUpdateSave({
      ...save,
      customizations: {
        ...save.customizations,
        [carId]: {
          ...custom,
          [field]: value,
          unlockedItems: isUnlocked(key)
            ? custom.unlockedItems
            : [...custom.unlockedItems, key],
        },
      },
    });
  };

  const buyUpgrade = (stat: keyof CarUpgrades) => {
    const current = upgrades[stat];
    if (current >= 5) return;
    const cost = getUpgradeCost(current);
    if (save.coins < cost) return;
    soundEngine.triggerUiClick();
    onUpdateSave({
      ...save,
      coins: save.coins - cost,
      upgrades: {
        ...save.upgrades,
        [carId]: {
          ...upgrades,
          [stat]: current + 1,
        },
      },
    });
  };

  const renderOptionCard = (
    field: keyof Omit<CarCustomization, 'unlockedItems'>,
    value: string,
    label: string,
    price: number,
    swatchHex?: string
  ) => {
    const key = `${field}:${value}`;
    const unlocked = isUnlocked(key) || price === 0;
    const active = custom[field] === value;
    const canAfford = save.coins >= price;

    return (
      <div
        key={key}
        className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-colors ${
          active
            ? 'bg-amber-500/15 border-amber-500 text-white'
            : 'bg-[#121826] border-slate-800 text-slate-200'
        }`}
      >
        <button
          onClick={() => applyCustomization(field, value, price, label)}
          disabled={!unlocked && !canAfford}
          className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer disabled:opacity-60"
        >
          {swatchHex && (
            <span
              className="w-5 h-5 rounded border border-white/20 shrink-0"
              style={{ backgroundColor: swatchHex }}
            />
          )}
          <div className="truncate">
            <div className="text-xs font-semibold truncate">{label}</div>
            <div className="text-[11px] text-slate-400 font-mono-num">
              {active ? 'Equipped' : unlocked ? 'Owned' : `${price} PTS`}
            </div>
          </div>
        </button>

        {active ? (
          <Check className="w-4 h-4 text-amber-400 shrink-0" />
        ) : !unlocked ? (
          <button
            onClick={() => unlockViaAd(field, value, label)}
            disabled={adBusy}
            title="Watch Ad to Unlock Free (One-Time)"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded cursor-pointer whitespace-nowrap shrink-0"
          >
            <Film className="w-3 h-3" />
            <span>Free Ad</span>
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col lg:flex-row bg-[#080a0f]">
      {/* Left: Rotating 3D Car Preview */}
      <div className="relative flex-1 min-h-[38vh] lg:min-h-full">
        <ShowroomCanvas
          carId={carId}
          customization={custom}
          damage={damage}
          interactive={true}
        />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="bg-[#0d111b]/92 border border-slate-800 rounded-lg px-4 py-2.5 pointer-events-auto">
            <div className="text-xs text-amber-400 font-medium">{car.brand}</div>
            <div className="font-display text-lg font-bold text-white">{car.name}</div>
          </div>

          <div className="flex items-center gap-2 bg-[#0d111b]/92 border border-amber-500/40 rounded-lg px-3.5 py-2 pointer-events-auto">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono-num text-sm font-bold text-amber-300">
              {save.coins.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Owned car switcher at bottom of 3D view */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 overflow-x-auto pb-1">
          {save.unlockedCars.map((id) => (
            <button
              key={id}
              onClick={() => {
                soundEngine.triggerUiClick();
                onUpdateSave({ ...save, selectedCar: id });
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap cursor-pointer transition-colors ${
                id === carId
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-[#0d111b]/92 text-slate-200 border-slate-700 hover:border-slate-500'
              }`}
            >
              {CAR_MAP[id].name}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Customization & Performance Panel */}
      <aside className="w-full lg:w-[440px] h-[62vh] lg:h-full bg-[#0d111b] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-display text-lg font-bold text-white">
            Custom Garage & Tuning
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close Garage"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Stats Strip */}
        <div className="grid grid-cols-4 gap-2 px-5 py-3 bg-[#0a0d16] border-b border-slate-800 text-center">
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
            <div className="text-[11px] text-slate-400">Handling</div>
            <div className="font-mono-num text-sm font-bold text-white">{eff.handling}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Braking</div>
            <div className="font-mono-num text-sm font-bold text-white">{eff.braking}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-[#0a0d16] border-b border-slate-800">
          {(
            [
              ['paint', 'Paint', Palette],
              ['wheels', 'Wheels', Sparkles],
              ['aero', 'Aero', Sparkles],
              ['performance', 'Tune', Gauge],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 dk-scroll">
          {tab === 'paint' && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Body Paint Color
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {PAINT_SWATCHES.map((sw) =>
                    renderOptionCard('paintColor', sw.hex, sw.name, sw.price, sw.hex)
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Paint Finish
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {PAINT_FINISHES.map((fin) =>
                    renderOptionCard('paintFinish', fin.id, fin.label, fin.price)
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Window Tint
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {WINDOW_TINTS.map((wt) =>
                    renderOptionCard('windowTint', wt.id, wt.label, wt.price)
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'wheels' && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Forged Rim Style
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {RIM_STYLES.map((r) =>
                    renderOptionCard('rimStyle', r.id, r.label, r.price)
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Tire Compound & Sidewall
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {TIRE_STYLES.map((t) =>
                    renderOptionCard('tireStyle', t.id, t.label, t.price)
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Brake Caliper Color
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {CALIPER_COLORS.map((c) =>
                    renderOptionCard('caliperColor', c.hex, c.name, c.price, c.hex)
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'aero' && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Rear Spoiler / Wing
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {SPOILER_STYLES.map((s) =>
                    renderOptionCard('spoiler', s.id, s.label, s.price)
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Body Kit
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {BODYKIT_STYLES.map((b) =>
                    renderOptionCard('bodyKit', b.id, b.label, b.price)
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  Underglow Lighting
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {UNDERGLOW_COLORS.map((u) =>
                    renderOptionCard('underglow', u.id, u.label, u.price, u.hex)
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'performance' && (
            <div className="space-y-3">
              {(
                [
                  ['engine', 'Engine Block & ECU', 'Increases top speed & power'],
                  ['turbo', 'Twin-Turbo / Boost', 'Improves acceleration launch'],
                  ['tires', 'Track Suspension & Grip', 'Sharpens cornering & drift recovery'],
                  ['brakes', 'Carbon-Ceramic Brakes', 'Shortens high-speed stopping distance'],
                ] as const
              ).map(([stat, title, desc]) => {
                const lvl = upgrades[stat];
                const maxed = lvl >= 5;
                const cost = getUpgradeCost(lvl);
                const canAfford = save.coins >= cost;

                return (
                  <div
                    key={stat}
                    className="p-3.5 bg-[#121826] border border-slate-800 rounded-lg space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{title}</div>
                        <div className="text-xs text-slate-400">{desc}</div>
                      </div>
                      <span className="font-mono-num text-xs font-bold text-amber-400 whitespace-nowrap">
                        Lv. {lvl}/5
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2, 3, 4].map((idx) => (
                        <div
                          key={idx}
                          className={`h-1.5 flex-1 rounded-sm ${
                            idx < lvl ? 'bg-amber-400' : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => buyUpgrade(stat)}
                      disabled={maxed || !canAfford}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {maxed ? 'Max Level Reached' : `Upgrade — ${cost.toLocaleString()} PTS`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
