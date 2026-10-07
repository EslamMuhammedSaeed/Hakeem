import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { setUnauthenticatedHandler } from './api/client.js';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
// Hidden for now (trades-only view) — restore by uncommenting
// import Dashboard from './pages/Dashboard.jsx';
// Hidden for now (trades-only view) — restore by uncommenting
// import InboxPage from './pages/Inbox.jsx';
import Login from './pages/Login.jsx';
// Hidden for now (trades-only view) — restore by uncommenting
// import Positions from './pages/Positions.jsx';
import Trades from './pages/Trades.jsx';

export default function App() {
  const queryClient = useQueryClient();

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      queryClient.setQueryData(['me'], null);
    });
  }, [queryClient]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          {/* Trades-only view: remove these redirects when restoring the routes below. */}
          <Route path="/" element={<Navigate to="/trades" replace />} />
          {/* Hidden for now (trades-only view) — restore by uncommenting
          <Route path="/" element={<Dashboard />} />
          */}
          {/* Hidden for now (trades-only view) — restore by uncommenting
          <Route path="/positions" element={<Positions />} />
          */}
          <Route path="/trades" element={<Trades />} />
          {/* Hidden for now (trades-only view) — restore by uncommenting
          <Route path="/inbox" element={<InboxPage />} />
          */}
          <Route path="*" element={<Navigate to="/trades" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
