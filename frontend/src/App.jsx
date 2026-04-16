import React, { useState, useEffect, useCallback, useRef } from 'react';
import Dashboard from './components/Dashboard';
import AlertsTable from './components/AlertsTable';
import FlowScope from './components/FlowScope';
import ReportViewer from './components/ReportViewer';
import { useWebSocket } from './hooks/useWebSocket';
import { fetchAlerts, generateDemoAlerts } from './services/api';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Command Center', icon: '📊' },
  { id: 'alerts',    label: 'Fraud Alerts',   icon: '🚨' },
  { id: 'flowscope', label: 'FlowScope',      icon: '🕸️' },
  { id: 'reports',   label: 'STR Reports',    icon: '📄' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [inferenceOnline, setInferenceOnline] = useState(false);
  const toastIdRef = useRef(0);
  const initialLoadDone = useRef(false);

  // ── INITIAL LOAD (once) ───────────────────────────────────────
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadAlerts = async () => {
      const data = await fetchAlerts();
      if (data && data.length > 0) {
        setAlerts(data);
        setBackendOnline(true);

        // Only check inference if backend is up
        fetch('/api/health').then(() => setInferenceOnline(true)).catch(() => {});
      } else {
        // Backend offline — load demo data, no more retries immediately
        setAlerts(generateDemoAlerts(15));
        setBackendOnline(false);
      }
    };

    loadAlerts();

    // Poll every 60s — not 10s — to avoid spam
    const interval = setInterval(async () => {
      const data = await fetchAlerts();
      if (data && data.length > 0) {
        setAlerts(data);
        if (!backendOnline) {
          setBackendOnline(true);
          fetch('/api/health').then(() => setInferenceOnline(true)).catch(() => {});
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  // ── TOAST ───────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 5000);
  }, []);

  // ── WEBSOCKET ───────────────────────────────────────────────
  const handleWebSocketAlert = useCallback((alert) => {
    setAlerts(prev => {
      if (prev.some(a => a.id === alert.id)) return prev;
      return [alert, ...prev].slice(0, 100);
    });
    setBackendOnline(true);
    showToast(
      `🚨 ${alert.typology} — Risk: ${alert.risk_level} — ₹${(alert.total_amount || 0).toLocaleString('en-IN')}`,
      'fraud'
    );
  }, [showToast]);

  const { connected: wsConnected } = useWebSocket(handleWebSocketAlert);

  // ── NAVIGATION ──────────────────────────────────────────────
  const handleSelectAlert = (alert) => { setSelectedAlert(alert); setPage('flowscope'); };
  const handleViewGraph   = (alert) => { setSelectedAlert(alert); setPage('flowscope'); };
  const handleViewReport  = (alert) => { setSelectedAlert(alert); setPage('reports'); };

  const highRiskCount = alerts.filter(
    a => a.risk_level === 'HIGH' || a.risk_level === 'CRITICAL'
  ).length;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>FinTracer</h1>
          <div className="brand-subtitle">AML Intelligence Platform</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.id === 'alerts' && highRiskCount > 0 && (
                <span className="nav-badge">{highRiskCount}</span>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-status">
          <div className="status-row">
            <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
            <span>Spring Boot API</span>
          </div>
          <div className="status-row">
            <span className={`status-dot ${wsConnected ? 'online' : 'offline'}`} />
            <span>WebSocket</span>
          </div>
          <div className="status-row">
            <span className={`status-dot ${inferenceOnline ? 'online' : 'offline'}`} />
            <span>GNN Inference</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {page === 'dashboard' && (
          <Dashboard alerts={alerts} onSelectAlert={handleSelectAlert} onNavigate={setPage} />
        )}
        {page === 'alerts' && (
          <AlertsTable alerts={alerts} onViewGraph={handleViewGraph} onViewReport={handleViewReport} />
        )}
        {page === 'flowscope' && (
          <FlowScope alert={selectedAlert} alerts={alerts} onSelectAlert={handleSelectAlert} />
        )}
        {page === 'reports' && (
          <ReportViewer alert={selectedAlert} alerts={alerts} />
        )}
      </main>

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type} ${toast.exiting ? 'toast-exit' : ''}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
