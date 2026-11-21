import React from 'react';
import { Keyboard, Smartphone, Gamepad2, X } from 'lucide-react';

interface TutorialOverlayProps {
  onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose }) => {
  const keys = [
    ['W / Up', 'Accelerate'],
    ['S / Down', 'Brake / Reverse'],
    ['A / D', 'Steer Left / Right'],
    ['SHIFT', 'Nitro Boost'],
    ['SPACE', 'Handbrake (Drift)'],
    ['H', 'Car Horn'],
    ['L', 'Headlights (Low / High / Off)'],
    ['Q / E / Z', 'Left / Right / Hazard Lights'],
    ['V', 'Windshield Wipers'],
    ['C', 'Switch Camera (Chase / Hood / Cockpit / Replay)'],
    ['R', 'Reset Car to Track'],
    ['ESC', 'Pause Menu'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070c]/92 p-4">
      <div className="w-full max-w-2xl bg-[#0d111b] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-display text-xl font-bold text-white">
            Welcome to DK Car Race — Driver Briefing
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto dk-scroll">
          <p className="text-sm text-slate-300 leading-relaxed">
            Every race builds a fresh procedural 3D circuit. Drift around hairpins to recharge Nitro, keep collisions low for Clean Driving bonuses, and invest your points in performance tuning, cosmetic kits, and new supercars.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {keys.map(([k, desc]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-[#121826] border border-slate-800 rounded-lg text-xs"
              >
                <span className="font-mono-num font-bold text-amber-300">{k}</span>
                <span className="text-slate-300 text-right">{desc}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs text-slate-300 pt-1">
            <div className="p-3 bg-[#121826] border border-slate-800 rounded-lg flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Keyboard Auto</span>
            </div>
            <div className="p-3 bg-[#121826] border border-slate-800 rounded-lg flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Mobile Touch</span>
            </div>
            <div className="p-3 bg-[#121826] border border-slate-800 rounded-lg flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Gamepad Ready</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg cursor-pointer"
          >
            Got It — Ready to Race
          </button>
        </div>
      </div>
    </div>
  );
};
