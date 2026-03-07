import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { FollowsProvider } from './hooks/useFollows';
import { ToastProvider } from './hooks/useToast';
import Header from './components/Header';
import ToastContainer from './components/Toast';
import PrivateRoute from './components/PrivateRoute';

import Login from './pages/Login';
import InviteCodeEntry from './pages/InviteCodeEntry';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import People from './pages/People';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import Stats from './pages/Stats';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FollowsProvider>
        <ToastProvider>
          <Header />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/invite" element={<InviteCodeEntry />} />
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/catalog" element={<PrivateRoute><Catalog /></PrivateRoute>} />
            <Route path="/people" element={<PrivateRoute><People /></PrivateRoute>} />
            <Route path="/collections" element={<PrivateRoute><Collections /></PrivateRoute>} />
            <Route path="/collections/:id" element={<PrivateRoute><CollectionDetail /></PrivateRoute>} />
            <Route path="/stats" element={<PrivateRoute><Stats /></PrivateRoute>} />
            <Route path="/profile/:uid" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          </Routes>
          <ToastContainer />
        </ToastProvider>
        </FollowsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
