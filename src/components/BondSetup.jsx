import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBonds } from '../hooks/useBonds';
import { useToast } from '../hooks/useToast';
import HelpTip from './HelpTip';

/**
 * Modal for creating a new bond with another user.
 * The initiator provides their Kindle email; the receiver accepts with theirs.
 */
export default function BondSetup({ targetUser, onClose }) {
  const { profile } = useAuth();
  const { createBond, getBondStatus } = useBonds();
  const { toast } = useToast();

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [kindleEmail, setKindleEmail] = useState(profile?.kindleEmail || '');
  const [sending, setSending] = useState(false);

  const { status } = getBondStatus(targetUser.uid);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!kindleEmail.endsWith('@kindle.com')) {
      toast('El email debe terminar en @kindle.com', 'error');
      return;
    }

    setSending(true);
    try {
      await createBond(targetUser.uid, targetUser.displayName, kindleEmail);
      toast(`Solicitud de vinculo enviada a ${targetUser.displayName}`, 'success');
      onClose();
    } catch (err) {
      toast('Error al crear vinculo: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (status !== 'none') {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        width: '100%',
        maxWidth: 440,
        padding: 28,
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>
          Vincular con {targetUser.displayName}
        </h2>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Al vincularte, ambos podran ver el catalogo del otro y enviarse libros directamente al Kindle.
          Para que funcione, ambos deben compartir su email @kindle.com y habilitar el remitente en Amazon.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              Tu email de Kindle
              <HelpTip text="Lo encontras en amazon.com/mycd → Devices → selecciona tu Kindle o la app. Es algo como nombre_XXXXX@kindle.com" />
            </label>
            <input
              type="email"
              value={kindleEmail}
              onChange={(e) => setKindleEmail(e.target.value)}
              placeholder="tu-email@kindle.com"
              required
              style={{ width: '100%' }}
            />
          </div>

          <div style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            marginBottom: 20,
            padding: '8px 12px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            lineHeight: 1.5,
          }}>
            Recorda habilitar el email remitente de la app en{' '}
            <a href="https://www.amazon.com/mycd" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}>
              amazon.com/mycd
            </a>
            {' '}→ Preferences → Approved Personal Document E-mail List.
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Inline component for accepting a pending bond.
 */
export function BondAccept({ bond, onAccepted }) {
  const { acceptBond } = useBonds();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [kindleEmail, setKindleEmail] = useState(profile?.kindleEmail || '');
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    if (!kindleEmail.endsWith('@kindle.com')) {
      toast('El email debe terminar en @kindle.com', 'error');
      return;
    }

    setAccepting(true);
    try {
      await acceptBond(bond.id, kindleEmail);
      toast(`Vinculo con ${bond.peerName} activado!`, 'success');
      if (onAccepted) onAccepted();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="email"
          value={kindleEmail}
          onChange={(e) => setKindleEmail(e.target.value)}
          placeholder="tu-email@kindle.com"
          style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
        />
        <button
          onClick={handleAccept}
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '6px 12px' }}
          disabled={accepting}
        >
          {accepting ? '...' : 'Aceptar vinculo'}
        </button>
      </div>
    </div>
  );
}
