import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box } from '@mui/material';

import { Header, SIDENAV_WIDTH, SIDENAV_COLLAPSED_WIDTH, HEADER_HEIGHT } from './components/Header';
import { SentimentPage } from './pages/SentimentPage';
import { InsightStoryPage } from './pages/InsightStoryPage';
import { NsaPage } from './pages/NsaPage';
import { LoginPage, RegisterPage, ResetPasswordPage } from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import Dashboard from './pages/Dashboard';
import { useAuth } from './context/AuthContext';
import Settings from './pages/Settings';

// ---------------------------------------------------------------------------
// Auth gate — unauthenticated users see login/register/reset
// ---------------------------------------------------------------------------

function AuthGate() {
  const [view, setView] = useState<'login' | 'register' | 'reset'>('login');

  switch (view) {
    case 'register':
      return <RegisterPage onSwitchToLogin={() => setView('login')} />;
    case 'reset':
      return <ResetPasswordPage onBackToLogin={() => setView('login')} />;
    default:
      return (
        <LoginPage
          onSwitchToRegister={() => setView('register')}
          onSwitchToReset={() => setView('reset')}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Protected shell — header + sidenav + routed content
// ---------------------------------------------------------------------------

function AppShell() {
  const [expanded, setExpanded] = useState(true);
  const sideWidth = expanded ? SIDENAV_WIDTH : SIDENAV_COLLAPSED_WIDTH;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#020617' }}>
      <Header expanded={expanded} onToggle={() => setExpanded((e) => !e)} />

      <Box
        sx={{
          ml: { xs: 0, lg: `${sideWidth}px` },
          mt: `${HEADER_HEIGHT}px`,
          transition: 'margin-left 0.25s ease',
          minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/nsa" element={<NsaPage />} />
          <Route path="/sentiment" element={<SentimentPage />} />
          <Route path="/insight" element={<InsightStoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/analytics" element={<ProfilePage />} />
          {/* Catch-all back to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Root — switches between auth gate and app shell
// ---------------------------------------------------------------------------

export default function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AppShell /> : <AuthGate />;
}
