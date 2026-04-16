import React from 'react';

const RISK_MAP = {
  'HIGH':       'critical',
  'CRITICAL':   'critical',
  'MEDIUM':     'medium',
  'LOW-MEDIUM': 'low',
  'LOW':        'low',
};

export default function RiskBadge({ level }) {
  const cls = RISK_MAP[level?.toUpperCase()] || 'low';
  return (
    <span className={`risk-badge ${cls}`}>
      <span style={{ fontSize: '0.6rem' }}>●</span>
      {level}
    </span>
  );
}
