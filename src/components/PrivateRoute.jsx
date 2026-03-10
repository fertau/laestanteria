import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';
import NameLogo from './NameLogo';

export default function PrivateRoute({ children }) {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <Logo size={48} />
        <NameLogo size="md" />
        <div className="progress-bar" style={{ marginTop: 8 }}>
          <div className="progress-bar-fill" />
        </div>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <Navigate to="/invite" replace />;
  }

  return children;
}
