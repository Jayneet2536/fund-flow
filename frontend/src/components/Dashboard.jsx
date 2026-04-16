import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import MetricCard from './MetricCard';
import AlertCard from './AlertCard';

function formatAmount(amt) {
  if (!amt) return '₹0';
  if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)} Cr`;
  if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
  return `₹${Math.round(amt).toLocaleString('en-IN')}`;
}

const RISK_COLORS = {
  HIGH: '#ff2d55',
  MEDIUM: '#ffab00',
  'LOW-MEDIUM': '#42a5f5',
  LOW: '#00e676',
};

const TYPO_COLORS = {
  'Fan-Out': '#ff6b6b',
  'Fan-In': '#ffa726',
  'Round-Trip': '#ab47bc',
  'Mutual': '#42a5f5',
  'Structuring': '#ef5350',
  'Dormant': '#78909c',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,23,55,0.95)',
      border: '1px solid rgba(100,140,255,0.15)',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: '0.78rem',
      color: '#e8ecf4',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ fontWeight: 600 }}>{payload[0].name || payload[0].payload?.name}</div>
      <div style={{ color: payload[0].color, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
        {payload[0].value}
      </div>
    </div>
  );
};

export default function Dashboard({ alerts, onSelectAlert, onNavigate }) {
  const metrics = useMemo(() => {
    const total = alerts.length;
    const highRisk = alerts.filter(a => a.risk_level === 'HIGH' || a.risk_level === 'CRITICAL').length;
    const totalAmount = alerts.reduce((s, a) => s + (a.total_amount || 0), 0);
    const avgScore = total > 0
      ? alerts.reduce((s, a) => s + (a.fraud_score || 0), 0) / total
      : 0;
    return { total, highRisk, totalAmount, avgScore };
  }, [alerts]);

  const riskDistribution = useMemo(() => {
    const counts = {};
    alerts.forEach(a => {
      const rl = a.risk_level || 'LOW';
      counts[rl] = (counts[rl] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: RISK_COLORS[name] || '#42a5f5',
    }));
  }, [alerts]);

  const typologyDistribution = useMemo(() => {
    const counts = {};
    alerts.forEach(a => {
      const t = a.typology || 'Unknown';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: TYPO_COLORS[name] || '#78909c',
    }));
  }, [alerts]);

  // Timeline data - group by hour
  const timelineData = useMemo(() => {
    const hourMap = {};
    for (let h = 0; h < 24; h++) {
      hourMap[h] = { hour: `${String(h).padStart(2, '0')}:00`, count: 0, highRisk: 0 };
    }
    alerts.forEach(a => {
      try {
        const hour = new Date(a.timestamp).getHours();
        hourMap[hour].count++;
        if (a.risk_level === 'HIGH') hourMap[hour].highRisk++;
      } catch {}
    });
    return Object.values(hourMap);
  }, [alerts]);

  return (
    <div>
      <div className="page-header">
        <h2>Command Center</h2>
        <p>Real-time AML transaction monitoring powered by Graph Neural Networks</p>
      </div>

      {/* KPI Metrics */}
      <div className="metrics-grid">
        <MetricCard
          icon="🚨"
          value={metrics.total}
          label="Total Alerts"
          trend={`${metrics.highRisk} critical`}
          trendDir="up"
        />
        <MetricCard
          icon="🔴"
          value={metrics.highRisk}
          label="High Risk"
          color="#ff2d55"
          trend="Requires action"
          trendDir="up"
        />
        <MetricCard
          icon="💰"
          value={formatAmount(metrics.totalAmount)}
          label="Total Flagged"
        />
        <MetricCard
          icon="🧠"
          value={`${(metrics.avgScore * 100).toFixed(1)}%`}
          label="Avg Risk Score"
          trend="GNN confidence"
        />
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-main">
          {/* Risk Distribution + Typology */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
            <div className="glass-card">
              <div className="section-title">
                <span className="icon">📊</span> Risk Distribution
              </div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {riskDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                {riskDistribution.map(d => (
                  <div key={d.name} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: '0.72rem', color: 'var(--text-secondary)'
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <div className="section-title">
                <span className="icon">🎯</span> Typology Breakdown
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={typologyDistribution} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={80}
                      tick={{ fontSize: 11, fill: '#8896b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                      {typologyDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="glass-card">
            <div className="section-title">
              <span className="icon">📈</span> 24h Alert Activity
            </div>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <AreaChart data={timelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00aaff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00aaff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="areaGradRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff2d55" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ff2d55" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#556388' }}
                    axisLine={false} tickLine={false} interval={3} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="#00aaff" strokeWidth={2}
                    fill="url(#areaGrad)" name="All Alerts" />
                  <Area type="monotone" dataKey="highRisk" stroke="#ff2d55" strokeWidth={2}
                    fill="url(#areaGradRed)" name="High Risk" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Sidebar — Live Alert Feed */}
        <div className="dashboard-sidebar-panel">
          <div className="glass-card" style={{ flex: 1 }}>
            <div className="section-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span className="icon">🔴</span> Live Alert Feed
              </div>
              <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                onClick={() => onNavigate?.('alerts')}>
                View All →
              </button>
            </div>
            <div className="alert-feed">
              {alerts.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">📡</div>
                  <p>Awaiting transactions…</p>
                  <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Alerts appear here in real-time</p>
                </div>
              ) : (
                alerts.slice(0, 10).map((alert, i) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    isNew={i === 0}
                    onClick={onSelectAlert}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
