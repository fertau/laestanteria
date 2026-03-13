import { useState, useEffect } from 'react';

/**
 * Banner shown below the header when the library folder handle
 * needs re-authorization (e.g. after a browser restart).
 * Only appears on Chromium browsers with a previously connected folder.
 */
export default function LibraryFolderBanner() {
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('../lib/libraryFolder.js');
        if (!mod.isLibraryFolderSupported()) return;
        const handle = await mod.getStoredHandle();
        if (!handle) return;
        // Silent check — no prompt, just see current state
        const perm = await mod.verifyPermission(handle, false);
        if (!cancelled && perm === 'prompt') {
          setNeedsPermission(true);
        }
      } catch {
        // Silently fail
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleReauthorize = async () => {
    try {
      const mod = await import('../lib/libraryFolder.js');
      const handle = await mod.getStoredHandle();
      if (!handle) return;
      const perm = await mod.verifyPermission(handle, true);
      if (perm === 'granted') {
        setNeedsPermission(false);
      }
    } catch {
      // User denied or error
    }
  };

  if (!needsPermission) return null;

  return (
    <div style={{
      background: 'rgba(193,123,63,0.15)',
      borderBottom: '1px solid var(--accent)',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontSize: 13,
      color: 'var(--accent)',
      flexWrap: 'wrap',
    }}>
      <span>Tu carpeta biblioteca necesita re-autorizacion.</span>
      <button
        onClick={handleReauthorize}
        className="btn btn-primary"
        style={{ fontSize: 12, padding: '4px 12px' }}
      >
        Autorizar acceso
      </button>
      <button
        onClick={() => setNeedsPermission(false)}
        className="btn-ghost"
        style={{ fontSize: 12, padding: '4px 8px' }}
      >
        Ignorar
      </button>
    </div>
  );
}
