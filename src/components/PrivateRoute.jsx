import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function PrivateRoute({ children }) {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="logo">La estanteria</div>
        <div className="spinner" />
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
