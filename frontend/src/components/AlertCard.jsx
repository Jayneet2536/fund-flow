import React from 'react';
import RiskBadge from './RiskBadge';
import TypologyTag from './TypologyTag';

function formatAmount(amt) {
  if (!amt) return '₹0';
  if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
  if (amt >= 100000)   return `₹${(amt / 100000).toFixed(2)} L`;
  return `₹${amt.toLocaleString('en-IN')}`;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AlertCard({ alert, isNew, onClick }) {
  const riskClass = (alert.risk_level === 'HIGH' || alert.risk_level === 'CRITICAL')
    ? 'risk-high'
    : alert.risk_level === 'MEDIUM'
    ? 'risk-medium'
    : 'risk-low';

  const firstEdge = alert.evidence_chain?.[0] || alert.graph_data?.edges?.[0];
  const fromName = firstEdge?.from_name || firstEdge?.source || '—';
  const toName = firstEdge?.to_name || firstEdge?.target || '—';

  return (
    <div
      className={`alert-card ${riskClass} ${isNew ? 'new-alert' : ''}`}
      onClick={() => onClick?.(alert)}
      id={`alert-${alert.id}`}
    >
      <div className="alert-card-header">
        <TypologyTag typology={alert.typology} />
        <RiskBadge level={alert.risk_level} />
      </div>
      <div className="alert-card-body">
        <div className="alert-flow">
          <span>{typeof fromName === 'string' ? fromName.slice(0, 18) : fromName}</span>
          <span className="arrow">→</span>
          <span>{typeof toName === 'string' ? toName.slice(0, 18) : toName}</span>
        </div>
        <span className="alert-amount">{formatAmount(alert.total_amount)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', alignItems: 'center' }}>
        <span className="alert-time">{timeAgo(alert.timestamp)}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Score: {(alert.fraud_score || 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
