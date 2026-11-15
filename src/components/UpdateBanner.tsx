import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type Phase = 'idle' | 'installing' | 'error';

export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    // Offline or dev builds have no release feed; an update check must never block the app
    check().then(found => setUpdate(found)).catch(() => setUpdate(null));
  }, []);

  if (!update) return null;

  const install = async () => {
    setPhase('installing');
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      setPhase('error');
    }
  };

  return (
    <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-4 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
      <span>
        {phase === 'error'
          ? 'Update failed. Try again later.'
          : `Version ${update.version} is available.`}
      </span>
      <button className="btn-primary" onClick={install} disabled={phase === 'installing'}>
        {phase === 'installing' ? 'Installing…' : phase === 'error' ? 'Retry' : 'Install and restart'}
      </button>
    </div>
  );
}
