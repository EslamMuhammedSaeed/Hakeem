import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { setUnauthenticatedHandler } from './api/client.js';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import InboxPage from './pages/Inbox.jsx';
import Login from './pages/Login.jsx';
import Positions from './pages/Positions.jsx';
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/positions" element={<Positions />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/inbox" element={<InboxPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
