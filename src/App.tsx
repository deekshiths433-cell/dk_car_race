import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/SoundEngine';
import { ExtrasModal } from './components/ExtrasModal';
import { GarageModal } from './components/GarageModal';
import { HomeMenu } from './components/HomeMenu';
import { LevelSelectModal } from './components/LevelSelectModal';
import { RaceHUD } from './components/RaceHUD';
import { RepairShopModal } from './components/RepairShopModal';
import { RewardedAdModal } from './components/RewardedAdModal';
import { SettingsModal } from './components/SettingsModal';
import { ShopModal } from './components/ShopModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { getLevelConfig } from './data/tracks';
import { RaceEngine } from './engine/RaceEngine';
import { AdPlacement, registerRewardedAdUiHandler } from './services/adSdk';
import {
  applyRaceResultToSave,
  createDefaultSaveData,
  loadSaveData,
  persistSaveData,
} from './services/storage';
import {
  ActiveModal,
  GameSettings,
  RaceResult,
  RaceTelemetry,
  SaveData,
  ScreenMode,
} from './types/game';

const INITIAL_TELEMETRY: RaceTelemetry = {
  speedKmh: 0,
  rpm: 950,
  redlineRpm: 7500,
  maxRpm: 8000,
  gear: 'N',
  totalGears: 7,
  nitro: 100,
  isBoosting: false,
  isDrifting: false,
  driftScore: 0,
  lap: 1,
  totalLaps: 2,
  position: 1,
  totalRacers: 4,
  raceTimeMs: 0,
  currentLapMs: 0,
  bestLapMs: null,
  headlights: 'low',
  indicators: 'off',
  wipersOn: false,
  cameraMode: 'chase',
  damageAvg: 0,
  countdownValue: 3,
  wrongWay: false,
  minimapPoints: [],
  minimapRacers: [],
  activeInput: 'keyboard',
};

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<ScreenMode>('home');
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [showTutorial, setShowTutorial] = useState(false);
  const [pendingStartAfterTutorial, setPendingStartAfterTutorial] = useState(false);

  // Race state
  const [raceRunId, setRaceRunId] = useState(0);
  const [paused, setPaused] = useState(false);
  const [raceSettingsOpen, setRaceSettingsOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<RaceTelemetry>(INITIAL_TELEMETRY);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [contextLost, setContextLost] = useState(false);

  // Rewarded ad modal state
  const [adPrompt, setAdPrompt] = useState<{
    placement: AdPlacement;
    itemLabel?: string;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const raceMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RaceEngine | null>(null);
  const saveRef = useRef<SaveData>(save);
  saveRef.current = save;

  const updateSave = useCallback((next: SaveData) => {
    setSave(next);
    persistSaveData(next);
  }, []);

  // Register Rewarded Ad UI bridge
  useEffect(() => {
    registerRewardedAdUiHandler((placement, itemLabel) => {
      return new Promise<boolean>((resolve) => {
        setAdPrompt({ placement, itemLabel, resolve });
      });
    });
    return () => registerRewardedAdUiHandler(null);
  }, []);

  const launchRace = useCallback(
    (levelOverride?: number) => {
      soundEngine.init();
      soundEngine.triggerUiClick();

      const targetLevel = levelOverride ?? saveRef.current.selectedLevel;
      if (targetLevel !== saveRef.current.selectedLevel) {
        updateSave({ ...saveRef.current, selectedLevel: targetLevel });
      }

      if (!saveRef.current.tutorialSeen) {
        setPendingStartAfterTutorial(true);
        setShowTutorial(true);
        return;
      }

      setActiveModal('none');
      setRaceResult(null);
      setNewAchievements([]);
      setPaused(false);
      setRaceSettingsOpen(false);
      setTelemetry(INITIAL_TELEMETRY);
      setScreen('racing');
      setRaceRunId((id) => id + 1);
    },
    [updateSave]
  );

  // Mount & manage isolated RaceEngine WebGL lifecycle
  useEffect(() => {
    if (screen !== 'racing') return;
    const container = raceMountRef.current;
    if (!container) return;

    const currentSave = saveRef.current;
    const levelCfg = getLevelConfig(currentSave.selectedLevel);

    const engine = new RaceEngine(
      container,
      {
        carId: currentSave.selectedCar,
        customization: currentSave.customizations[currentSave.selectedCar],
        upgrades: currentSave.upgrades[currentSave.selectedCar],
        damage: currentSave.damages[currentSave.selectedCar],
        levelConfig: levelCfg,
        settings: currentSave.settings,
      },
      {
        onTelemetry: (t) => setTelemetry(t),
        onPauseRequest: () => {
          setPaused((prev) => {
            const next = !prev;
            engineRef.current?.setPaused(next);
            return next;
          });
        },
        onFinish: (res) => {
          const { next, newlyUnlockedAchievements } = applyRaceResultToSave(
            saveRef.current,
            res,
            levelCfg.weather
          );
          updateSave(next);
          setNewAchievements(newlyUnlockedAchievements);
          setRaceResult(res);
        },
      }
    );

    engineRef.current = engine;

    const canvas = container.querySelector('canvas');
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);
    canvas?.addEventListener('webglcontextlost', onLost);
    canvas?.addEventListener('webglcontextrestored', onRestored);

    return () => {
      canvas?.removeEventListener('webglcontextlost', onLost);
      canvas?.removeEventListener('webglcontextrestored', onRestored);
      engine.dispose();
      engineRef.current = null;
    };
  }, [screen, raceRunId, updateSave]);

  // Enter/Space shortcut on Home Screen to start race
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen === 'home' && activeModal === 'none' && !showTutorial && !adPrompt) {
        if (e.key === 'Enter') {
          e.preventDefault();
          launchRace();
        }
      } else if (screen === 'home' && activeModal !== 'none' && e.key === 'Escape') {
        setActiveModal('none');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, activeModal, showTutorial, adPrompt, launchRace]);

  const handlePauseToggle = () => {
    const next = !paused;
    setPaused(next);
    engineRef.current?.setPaused(next);
  };

  const handleSettingsChange = (nextSettings: GameSettings) => {
    updateSave({ ...save, settings: nextSettings });
    engineRef.current?.updateSettings(nextSettings);
  };

  const handleCloseTutorial = () => {
    const wasPending = pendingStartAfterTutorial;
    setShowTutorial(false);
    setPendingStartAfterTutorial(false);
    if (!save.tutorialSeen) {
      const updated = { ...save, tutorialSeen: true };
      updateSave(updated);
      saveRef.current = updated;
    }
    if (wasPending) {
      setActiveModal('none');
      setRaceResult(null);
      setNewAchievements([]);
      setPaused(false);
      setRaceSettingsOpen(false);
      setTelemetry(INITIAL_TELEMETRY);
      setScreen('racing');
      setRaceRunId((id) => id + 1);
    }
  };

  return (
    <div className="w-full h-full relative bg-[#080a0f] overflow-hidden">
      {screen === 'home' && (
        <HomeMenu
          save={save}
          onPlayRace={() => launchRace()}
          onOpenModal={(m) => {
            soundEngine.triggerUiClick();
            setActiveModal(m);
          }}
          onOpenTutorial={() => {
            soundEngine.triggerUiClick();
            setPendingStartAfterTutorial(false);
            setShowTutorial(true);
          }}
        />
      )}

      {screen === 'racing' && (
        <div className="relative w-full h-full">
          {/* Isolated WebGL canvas mount */}
          <div ref={raceMountRef} className="w-full h-full" />

          {contextLost && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080a0f]/95 text-center p-6">
              <div className="space-y-3">
                <h2 className="font-display text-xl font-bold text-white">
                  3D Graphics Context Paused
                </h2>
                <button
                  onClick={() => setRaceRunId((id) => id + 1)}
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-sm rounded-lg cursor-pointer"
                >
                  Reload Circuit
                </button>
              </div>
            </div>
          )}

          <RaceHUD
            telemetry={telemetry}
            settings={save.settings}
            paused={paused}
            result={raceResult}
            newlyUnlockedAchievements={newAchievements}
            onPauseToggle={handlePauseToggle}
            onRestart={() => launchRace()}
            onNextLevel={() => launchRace(save.selectedLevel + 1)}
            onOpenSettings={() => setRaceSettingsOpen(true)}
            onOpenGarage={() => {
              setScreen('home');
              setActiveModal('garage');
            }}
            onGoHome={() => {
              setScreen('home');
              setActiveModal('none');
            }}
            onCycleLights={() => engineRef.current?.cycleHeadlights()}
            onCycleCamera={() => engineRef.current?.cycleCamera()}
            onToggleIndicator={(side) => engineRef.current?.toggleIndicator(side)}
            onToggleHazard={() => engineRef.current?.toggleHazard()}
            onToggleWipers={() => engineRef.current?.toggleWipers()}
            onResetCar={() => engineRef.current?.resetPlayerToTrack()}
            onTouchInput={(partial, horn) =>
              engineRef.current?.setTouchInput(partial, horn)
            }
          />

          {raceSettingsOpen && (
            <SettingsModal
              settings={save.settings}
              onChange={handleSettingsChange}
              onClose={() => setRaceSettingsOpen(false)}
            />
          )}
        </div>
      )}

      {/* Home Modals */}
      {screen === 'home' && activeModal === 'garage' && (
        <GarageModal
          save={save}
          onUpdateSave={updateSave}
          onClose={() => setActiveModal('none')}
        />
      )}

      {screen === 'home' && activeModal === 'repair' && (
        <RepairShopModal
          save={save}
          onUpdateSave={updateSave}
          onClose={() => setActiveModal('none')}
        />
      )}

      {screen === 'home' && activeModal === 'levels' && (
        <LevelSelectModal
          save={save}
          onSelectLevel={(lvl, startImmediately) => {
            updateSave({ ...save, selectedLevel: lvl });
            if (startImmediately) {
              launchRace(lvl);
            }
          }}
          onClose={() => setActiveModal('none')}
        />
      )}

      {screen === 'home' && activeModal === 'shop' && (
        <ShopModal
          save={save}
          onUpdateSave={updateSave}
          onClose={() => setActiveModal('none')}
        />
      )}

      {screen === 'home' && activeModal === 'extras' && (
        <ExtrasModal
          save={save}
          onUpdateSave={updateSave}
          onClose={() => setActiveModal('none')}
        />
      )}

      {screen === 'home' && activeModal === 'settings' && (
        <SettingsModal
          settings={save.settings}
          onChange={handleSettingsChange}
          onResetSave={() => updateSave(createDefaultSaveData())}
          onClose={() => setActiveModal('none')}
        />
      )}

      {showTutorial && <TutorialOverlay onClose={handleCloseTutorial} />}

      {adPrompt && (
        <RewardedAdModal
          placement={adPrompt.placement}
          itemLabel={adPrompt.itemLabel}
          onComplete={(ok) => {
            const { resolve } = adPrompt;
            setAdPrompt(null);
            resolve(ok);
          }}
        />
      )}
    </div>
  );
}
