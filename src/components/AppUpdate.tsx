import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'upToDate' }
  | { kind: 'available'; update: Update }
  | { kind: 'installing' }
  | { kind: 'error'; message: string };

export function AppUpdate() {
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''));
  }, []);

  const checkForUpdate = async () => {
    setStatus({ kind: 'checking' });
    try {
      const update = await check();
      setStatus(update ? { kind: 'available', update } : { kind: 'upToDate' });
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) });
    }
  };

  const install = async (update: Update) => {
    setStatus({ kind: 'installing' });
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) });
    }
  };

  return (
    <div className="card">
      <h2 className="section-title mb-4">App Updates</h2>
      <p className="text-sm text-slate-500 mb-4">
        Current version {version ? <span className="font-mono">{version}</span> : 'unknown'}.
      </p>

      <div className="flex gap-3">
        {status.kind === 'available' || status.kind === 'installing' ? (
          <button
            className="btn-primary"
            onClick={() => status.kind === 'available' && install(status.update)}
            disabled={status.kind === 'installing'}
          >
            {status.kind === 'installing' ? 'Installing…' : `Install ${status.update.version} and restart`}
          </button>
        ) : (
          <button className="btn-primary" onClick={checkForUpdate} disabled={status.kind === 'checking'}>
            {status.kind === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>

      {status.kind === 'upToDate' && (
        <p className="text-sm text-green-600 mt-3">✓ You're on the latest version.</p>
      )}
      {status.kind === 'available' && (
        <p className="text-sm text-blue-600 mt-3">Version {status.update.version} is available.</p>
      )}
      {status.kind === 'error' && (
        <p className="text-sm text-red-600 mt-3">Update failed: {status.message}</p>
      )}
    </div>
  );
}
