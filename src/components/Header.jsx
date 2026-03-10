import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';
import NameLogo from './NameLogo';
import { Home, BookOpen, Users, Layers, BarChart3, Bell } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Inicio', icon: Home },
  { path: '/catalog', label: 'Catalogo', icon: BookOpen },
  { path: '/people', label: 'Personas', icon: Users },
  { path: '/collections', label: 'Colecciones', icon: Layers },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
];

export default function Header({ notificationCount = 0 }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  if (!profile) return null;

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(15, 12, 8, 0.9)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '0 20px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo + Name */}
        <Link to="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
        }}>
          <Logo size={30} />
          <NameLogo size="sm" className="name-logo-header" />
        </Link>

        {/* Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  color: location.pathname === item.path ? 'var(--accent)' : 'var(--text-muted)',
                  textDecoration: 'none',
                  transition: 'color var(--transition)',
                }}
              >
                <Icon size={16} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}

          <Link
            to="/notifications"
            title="Notificaciones"
            style={{
              position: 'relative',
              padding: '6px 10px',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 16,
            }}
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                width: 16,
                height: 16,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </Link>
        </nav>

        {/* User section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to={`/profile/${profile.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt=""
                style={{ width: 28, height: 28, borderRadius: '50%' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
              }}>
                {(profile.displayName || '?')[0].toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 13 }} className="nav-label">
              {profile.displayName?.split(' ')[0]}
            </span>
          </Link>

          <button
            onClick={signOut}
            className="btn-ghost"
            style={{ fontSize: 12, padding: '4px 8px' }}
          >
            Salir
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .nav-label { display: none; }
          .name-logo-header { display: none; }
        }
      `}</style>
    </header>
  );
}
