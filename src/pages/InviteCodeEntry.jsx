import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

export default function InviteCodeEntry() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { validateInviteCode, signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      await validateInviteCode(code);
      toast('Bienvenido/a a La Cueva!', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 40,
        maxWidth: 400,
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--accent)',
          marginBottom: 8,
        }}>
          Codigo de invitacion
        </div>

        <p style={{
          color: 'var(--text-muted)',
          fontSize: 14,
          marginBottom: 28,
        }}>
          Hola {user.displayName?.split(' ')[0] || ''}! Para acceder necesitas un codigo de invitacion. Pedile uno a alguien del grupo.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: 24,
              letterSpacing: 4,
              fontWeight: 700,
              fontFamily: 'monospace',
              padding: '14px 16px',
              marginBottom: 16,
            }}
            autoFocus
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || code.length < 8}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? (
              <span className="spinner" style={{ width: 18, height: 18 }} />
            ) : (
              'Validar codigo'
            )}
          </button>
        </form>

        <button
          onClick={handleCancel}
          className="btn btn-ghost"
          style={{ marginTop: 16, fontSize: 13 }}
        >
          Cancelar y cerrar sesion
        </button>
      </div>
    </div>
  );
}
