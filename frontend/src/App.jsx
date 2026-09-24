import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Positions from './pages/Positions.jsx';
import Trades from './pages/Trades.jsx';
import InboxPage from './pages/Inbox.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/inbox" element={<InboxPage />} />
      </Routes>
    </Layout>
  );
}
