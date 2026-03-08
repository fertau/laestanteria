import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const items = [
  { path: '/', label: 'Inicio', icon: '~' },
  { path: '/catalog', label: 'Catalogo', icon: '#' },
  { path: '/people', label: 'Personas', icon: '@' },
  { path: '/collections', label: 'Colecciones', icon: '=' },
  { path: '/stats', label: 'Stats', icon: '%' },
];

export default function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();

  if (!profile) return null;

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={location.pathname === item.path ? 'active' : ''}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
