/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { ApiKeyProvider, useApiKey } from './contexts/ApiKeyContext';
import { GameProvider } from './contexts/GameContext';
import Home from './pages/Home';
import HostDashboard from './pages/host/Dashboard';
import HostRoom from './pages/host/Room';
import PlayerJoin from './pages/player/Join';
import PlayerRoom from './pages/player/Room';
import { KeyRound } from 'lucide-react';

function AppHeader() {
  const { apiKey, showSettings } = useApiKey();

  // Chỉ hiện nút Settings khi đã có API key
  if (!apiKey) return null;

  return (
    <div className="fixed top-0 right-0 z-40 p-3">
      <button
        onClick={showSettings}
        className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 hover:bg-white transition group"
      >
        <KeyRound size={18} className="text-indigo-600" />
        <span className="text-sm font-bold text-slate-700">API Key ✓</span>
      </button>
    </div>
  );
}

export default function App() {
  return (
    <ApiKeyProvider>
      <GameProvider>
        <AppHeader />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/host" element={<HostDashboard />} />
            <Route path="/host/room/:pin" element={<HostRoom />} />
            <Route path="/play" element={<PlayerJoin />} />
            <Route path="/play/:pin" element={<PlayerRoom />} />
          </Routes>
        </BrowserRouter>
      </GameProvider>
    </ApiKeyProvider>
  );
}
