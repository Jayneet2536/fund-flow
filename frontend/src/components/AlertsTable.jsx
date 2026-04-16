import React, { useState, useMemo } from 'react';
import RiskBadge from './RiskBadge';
import TypologyTag from './TypologyTag';
import EvidenceChain from './EvidenceChain';

function formatAmount(amt) {
  if (!amt) return '₹0';
  if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
  if (amt >= 100000) return `₹${(amt / 100000).toFixed(2)} L`;
  return `₹${Math.round(amt).toLocaleString('en-IN')}`;
}

function formatTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
}

export default function AlertsTable({ alerts, onViewGraph, onViewReport }) {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [typoFilter, setTypoFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedTab, setExpandedTab] = useState('evidence');

  const filtered = useMemo(() => {
    let data = [...alerts];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(a =>
        a.id?.toLowerCase().includes(q) ||
        a.typology?.toLowerCase().includes(q) ||
        a.accounts_involved?.some(acc => acc.toLowerCase().includes(q))
      );
    }

    if (riskFilter !== 'ALL') {
      data = data.filter(a => a.risk_level === riskFilter);
    }

    if (typoFilter !== 'ALL') {
      data = data.filter(a => a.typology === typoFilter);
    }

    data.sort((a, b) => {
      let va, vb;
      switch (sortBy) {
        case 'fraud_score': va = a.fraud_score || 0; vb = b.fraud_score || 0; break;
        case 'total_amount': va = a.total_amount || 0; vb = b.total_amount || 0; break;
        case 'risk_level':
          const order = { HIGH: 3, MEDIUM: 2, 'LOW-MEDIUM': 1, LOW: 0 };
          va = order[a.risk_level] ?? 0;
          vb = order[b.risk_level] ?? 0;
          break;
        default: va = a.timestamp || ''; vb = b.timestamp || '';
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [alerts, search, riskFilter, typoFilter, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const sortIcon = (col) =>
    sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const riskBreakdownItems = (breakdown) => {
    if (!breakdown) return [];
    return Object.entries(breakdown)
      .filter(([k]) => k !== 'reason')
      .map(([k, v]) => ({
        label: k.replace(/_/g, ' '),
        value: typeof v === 'number' ? v.toFixed(3) : String(v),
        pct: typeof v === 'number' ? Math.min(v / 2, 1) : 0,
      }));
  };

  return (
    <div>
      <div className="page-header">
        <h2>Fraud Alerts</h2>
        <p>Manage and investigate detected suspicious activity patterns</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          id="alert-search"
          type="text"
          placeholder="🔍  Search by ID, typology, or account…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select id="risk-filter" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
          <option value="ALL">All Risk Levels</option>
          <option value="HIGH">🔴 High</option>
          <option value="MEDIUM">🟡 Medium</option>
          <option value="LOW-MEDIUM">🔵 Low-Medium</option>
          <option value="LOW">🟢 Low</option>
        </select>
        <select id="typo-filter" value={typoFilter} onChange={e => setTypoFilter(e.target.value)}>
          <option value="ALL">All Typologies</option>
          <option value="Fan-Out">Fan-Out</option>
          <option value="Fan-In">Fan-In</option>
          <option value="Round-Trip">Round-Trip</option>
          <option value="Mutual">Mutual</option>
          <option value="Structuring">Structuring</option>
          <option value="Dormant">Dormant</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {filtered.length} of {alerts.length} alerts
        </span>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="data-table-wrap">
          <table className="data-table" id="alerts-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('timestamp')}>Time{sortIcon('timestamp')}</th>
                <th>Typology</th>
                <th onClick={() => handleSort('risk_level')}>Risk{sortIcon('risk_level')}</th>
                <th onClick={() => handleSort('fraud_score')}>Score{sortIcon('fraud_score')}</th>
                <th onClick={() => handleSort('total_amount')}>Amount{sortIcon('total_amount')}</th>
                <th>Accounts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <div className="icon">🔍</div>
                      <p>No alerts match your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(alert => (
                  <React.Fragment key={alert.id}>
                    <tr onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                      style={{ background: expandedId === alert.id ? 'rgba(0,170,255,0.04)' : undefined }}>
                      <td className="td-mono">{formatTime(alert.timestamp)}</td>
                      <td><TypologyTag typology={alert.typology} /></td>
                      <td><RiskBadge level={alert.risk_level} /></td>
                      <td className="td-mono" style={{
                        color: alert.fraud_score > 0.7 ? 'var(--risk-critical)' :
                               alert.fraud_score > 0.5 ? 'var(--risk-medium)' : 'var(--text-secondary)',
                        fontWeight: 600,
                      }}>
                        {(alert.fraud_score || 0).toFixed(4)}
                      </td>
                      <td className="td-amount">{formatAmount(alert.total_amount)}</td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {alert.accounts_involved?.length || 0} accounts
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                            onClick={() => onViewGraph?.(alert)}>
                            🕸️ Graph
                          </button>
                          <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                            onClick={() => onViewReport?.(alert)}>
                            📄 Report
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedId === alert.id && (
                      <tr className="expanded-row">
                        <td colSpan="7" style={{ padding: 0 }}>
                          <div className="expanded-content">
                            <div className="expanded-tabs">
                              <button className={`expanded-tab ${expandedTab === 'evidence' ? 'active' : ''}`}
                                onClick={() => setExpandedTab('evidence')}>Evidence Chain</button>
                              <button className={`expanded-tab ${expandedTab === 'risk' ? 'active' : ''}`}
                                onClick={() => setExpandedTab('risk')}>Risk Breakdown</button>
                              <button className={`expanded-tab ${expandedTab === 'accounts' ? 'active' : ''}`}
                                onClick={() => setExpandedTab('accounts')}>Accounts</button>
                            </div>

                            {expandedTab === 'evidence' && (
                              <EvidenceChain chain={alert.evidence_chain} />
                            )}

                            {expandedTab === 'risk' && (
                              <div className="risk-breakdown">
                                {riskBreakdownItems(alert.risk_breakdown).map(item => (
                                  <div key={item.label} className="risk-factor">
                                    <span className="risk-factor-label">{item.label}</span>
                                    <span className="risk-factor-value">{item.value}</span>
                                    <div className="risk-factor-bar">
                                      <div className="risk-factor-bar-fill" style={{
                                        width: `${item.pct * 100}%`,
                                        background: item.pct > 0.6 ? 'var(--risk-critical)' :
                                                    item.pct > 0.4 ? 'var(--risk-medium)' : 'var(--accent-blue)',
                                      }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {expandedTab === 'accounts' && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {(alert.accounts_involved || []).map(acc => (
                                  <div key={acc} style={{
                                    padding: '6px 12px',
                                    background: 'rgba(100,140,255,0.06)',
                                    borderRadius: 6,
                                    fontSize: '0.8rem',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--text-accent)',
                                    border: '1px solid rgba(100,140,255,0.1)',
                                  }}>
                                    {acc}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
