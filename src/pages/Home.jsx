import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const { profile } = useAuth();

  return (
    <div className="page">
      <h1 className="page-title">Hola, {profile?.displayName?.split(' ')[0]}</h1>

      {/* Onboarding placeholder — will be replaced by real content in Phase 6 */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 40,
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Bienvenido/a a La estanteria</p>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          Empeza siguiendo a alguien del grupo para ver sus libros.
        </p>
        <Link to="/people" className="btn btn-primary">
          Ver personas
        </Link>
      </div>
    </div>
  );
}
