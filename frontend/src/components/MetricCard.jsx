import React from 'react';

export default function MetricCard({ icon, value, label, trend, trendDir, color }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div className="metric-value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="metric-label">{label}</div>
      {trend && (
        <div className={`metric-trend ${trendDir || ''}`}>
          {trendDir === 'up' ? '▲' : trendDir === 'down' ? '▼' : ''}
          {' '}{trend}
        </div>
      )}
    </div>
  );
}
