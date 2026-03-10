import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Home, BookOpen, Users, Layers, BarChart3 } from 'lucide-react';

const items = [
  { path: '/', label: 'Inicio', icon: Home },
  { path: '/catalog', label: 'Catalogo', icon: BookOpen },
  { path: '/people', label: 'Personas', icon: Users },
  { path: '/collections', label: 'Colecciones', icon: Layers },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
];

export default function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();

  if (!profile) return null;

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={location.pathname === item.path ? 'active' : ''}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
