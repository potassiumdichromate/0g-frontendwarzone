import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from "./pages/home/index";
import { Game } from "./pages/game/GamePage";
import { Game2 } from "./pages/game/Game2Page";
import { Leaderboard } from "./pages/leaderboard/index";
import IAP from "./pages/iap/iap";
import { WalletProvider } from './contexts/WalletContext';
import { useWallet } from './contexts/WalletContext';
import InterversePlayPage from './pages/intraverse/InterversePlayPage';
import IntraverseLogin from './pages/intraverse/IntraverseLogin';
import IntraverseLoginButton from './pages/intraverse/IntraverseLoginButton';
import AutoLogin from './pages/AutoLogin';
import LoginPage from './pages/LoginPage';
import OGDashboard from './pages/og-dashboard/OGDashboard';
import './App.css';
import './styles/warzone-ui.css';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isConnected } = useWallet();
  return isConnected ? children : <Navigate to="/" replace />;
};

function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="app-routes">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route 
            path="/game" 
            element={
              <ProtectedRoute>
                <Game />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/game2"
            element={
              <ProtectedRoute>
                <Game2 />
              </ProtectedRoute>
            }
          />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/iap" element={<IAP />} />
          <Route path="/tournament" element={<InterversePlayPage />} />
          <Route path="/auth" element={<IntraverseLoginButton />} />
          <Route path="/callback/*" element={<IntraverseLogin />} />
          <Route path="/auth/callback/intraverse/callback/*" element={<IntraverseLogin />} />
          <Route path="/intraverse-auth/callback/*" element={<IntraverseLogin />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auto-login" element={<AutoLogin />} />
          <Route
            path="/og-dashboard"
            element={
              <ProtectedRoute>
                <OGDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <Router>
        <AppShell />
      </Router>
    </WalletProvider>
  );
}

export default App;
