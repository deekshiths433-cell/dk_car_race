import React, { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { AdPlacement } from '../services/adSdk';

interface RewardedAdModalProps {
  placement: AdPlacement;
  itemLabel?: string;
  onComplete: (completed: boolean) => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  placement,
  itemLabel,
  onComplete,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4">
      <div className="w-full max-w-md bg-[#0d111b] border border-cyan-500/40 rounded-xl p-6 space-y-5 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
          <Film className="w-6 h-6 text-cyan-400" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-semibold text-cyan-400">
            Sponsored Rewarded Ad (SDK Placeholder)
          </div>
          <h3 className="font-display text-lg font-bold text-white">
            {placement === 'repair_free'
              ? 'Free Pit-Lane Full Repair'
              : `Unlock Free: ${itemLabel || 'Custom Item'}`}
          </h3>
          <p className="text-xs text-slate-400">
            Placeholder rewarded-ad slot ready for AdMob or Unity Ads SDK replacement.
          </p>
        </div>

        <div className="py-4 px-3 bg-[#080a10] border border-slate-800 rounded-lg">
          {secondsLeft > 0 ? (
            <div className="font-mono-num text-2xl font-bold text-amber-400">
              Reward in {secondsLeft}s
            </div>
          ) : (
            <div className="font-display text-base font-bold text-emerald-400">
              Reward Unlocked!
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onComplete(false)}
            className="flex-1 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
          >
            Skip (No Reward)
          </button>
          <button
            onClick={() => onComplete(true)}
            disabled={secondsLeft > 0}
            className="flex-1 py-2.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-lg cursor-pointer"
          >
            Claim Reward
          </button>
        </div>
      </div>
    </div>
  );
};
