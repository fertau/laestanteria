import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Logo from '../components/Logo';
import NameLogo from '../components/NameLogo';

export default function Login() {
  const { signIn, user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  // If already logged in with profile, redirect
  if (user && profile) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await signIn();
      if (result) {
        // onAuthStateChanged will handle the rest
      }
    } catch (err) {
      toast('Error al iniciar sesion: ' + err.message, 'error');
      setSigningIn(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 20,
      textAlign: 'center',
    }}>
      {/* Logo SVG grande */}
      <Logo size={80} />

      {/* Name Logo tipográfico */}
      <div style={{ marginTop: 16, marginBottom: 12 }}>
        <NameLogo size="lg" />
      </div>

      {/* Subtítulo */}
      <p style={{
        color: 'var(--text-muted)',
        fontSize: 15,
        fontWeight: 300,
        fontFamily: 'var(--font-body)',
        marginBottom: 40,
        maxWidth: 320,
        lineHeight: 1.5,
      }}>
        Tu biblioteca entre amigos
      </p>

      {signingIn && (
        <div className="progress-bar" style={{ marginBottom: 24 }}>
          <div className="progress-bar-fill" />
        </div>
      )}

      <button
        onClick={handleSignIn}
        disabled={signingIn}
        className="login-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 28px',
          background: '#fff',
          color: '#333',
          borderRadius: 'var(--radius)',
          fontSize: 15,
          fontWeight: 600,
          border: 'none',
          cursor: signingIn ? 'wait' : 'pointer',
          transition: 'transform var(--transition), box-shadow var(--transition)',
          opacity: signingIn ? 0.7 : 1,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Iniciar sesión con Google
      </button>

      <p style={{
        color: 'var(--text-dim)',
        fontSize: 12,
        marginTop: 24,
      }}>
        Necesitás un código de invitación para registrarte.
      </p>
    </div>
  );
}
