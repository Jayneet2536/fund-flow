import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Shield, Activity, AlertTriangle, TrendingUp, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { getAlerts } from '../api'
import { useWebSocket } from '../hooks/useWebSocket'
import FraudAlertCard from './FraudAlertCard'
import FraudDetailModal from './FraudDetailModal'
import GraphView from './GraphView'

const DEMO_ALERTS = [
  { id: 'TXN-0091', transactionId: 'TXN-0091', typology: 'Round-Trip', riskLevel: 'HIGH', fraudScore: 0.92, senderAccount: 'ACC-112', receiverAccount: 'ACC-449', amount: 240000, paymentType: 'NEFT', timestamp: '02:14 AM', graphHops: 3, graphData: { nodes: [], edges: [] }, evidenceChain: ['ACC-112 -> ACC-220 | INR 240,000 | NEFT', 'ACC-220 -> ACC-449 | INR 238,000 | RTGS', 'ACC-449 -> ACC-112 | INR 235,000 | RTGS'] },
  { id: 'TXN-0087', transactionId: 'TXN-0087', typology: 'Fan-Out', riskLevel: 'HIGH', fraudScore: 0.85, senderAccount: 'ACC-008', receiverAccount: 'ACC-220', amount: 98500, paymentType: 'UPI', timestamp: '11:47 PM', graphHops: 2, graphData: { nodes: [], edges: [] }, evidenceChain: [] },
  { id: 'TXN-0083', transactionId: 'TXN-0083', typology: 'Structuring', riskLevel: 'MEDIUM', fraudScore: 0.71, senderAccount: 'ACC-331', receiverAccount: 'ACC-107', amount: 49900, paymentType: 'UPI', timestamp: '09:22 AM', graphHops: 2, graphData: { nodes: [], edges: [] }, evidenceChain: [] },
]

function computeStats(alerts) {
  return {
    totalTransactions: alerts.reduce((sum, alert) => sum + Math.max(alert.graphHops || 1, 1), 0),
    totalAlerts: alerts.length,
    highRisk: alerts.filter((alert) => alert.riskLevel === 'HIGH').length,
    avgFraudScore: alerts.length
      ? alerts.reduce((sum, alert) => sum + (alert.fraudScore || 0), 0) / alerts.length
      : 0,
  }
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState([])
  const [selectedAlert, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [backendUp, setBackendUp] = useState(false)
  const [filter, setFilter] = useState('ALL')
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')

  const { liveAlerts, connected } = useWebSocket()

  const fetchData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)

    try {
      const alertsRes = await getAlerts()
      setAlerts(alertsRes.data)
      setBackendUp(true)
      setLoadError('')
    } catch {
      setAlerts(DEMO_ALERTS)
      setBackendUp(false)
      setLoadError('Backend controllers are unavailable, showing demo data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const allAlerts = useMemo(() => {
    const merged = [...liveAlerts, ...alerts].reduce((acc, alert) => {
      if (!acc.find((item) => item.transactionId === alert.transactionId)) {
        acc.push(alert)
      }
      return acc
    }, [])

    return merged.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
  }, [liveAlerts, alerts])

  useEffect(() => {
    if (!selectedAlert && allAlerts.length > 0) {
      setSelected(allAlerts[0])
      return
    }

    if (selectedAlert) {
      const refreshedSelected = allAlerts.find((alert) => alert.transactionId === selectedAlert.transactionId)
      if (refreshedSelected) setSelected(refreshedSelected)
    }
  }, [allAlerts, selectedAlert])

  const filtered = filter === 'ALL' ? allAlerts : allAlerts.filter((alert) => alert.riskLevel === filter)
  const stats = useMemo(() => computeStats(allAlerts), [allAlerts])

  const FILTER_OPTIONS = ['ALL', 'HIGH', 'MEDIUM', 'LOW']
  const FILTER_COLORS = { HIGH: 'var(--red)', MEDIUM: 'var(--amber)', LOW: 'var(--green)', ALL: 'var(--accent)' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--accent)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>FundFlow</div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', fontFamily: 'var(--mono)' }}>Fraud Detection System</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
            background: backendUp ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `1px solid ${backendUp ? 'var(--green-border)' : 'var(--red-border)'}`,
            color: backendUp ? 'var(--green)' : 'var(--red)',
          }}>
            {backendUp ? <Wifi size={11} /> : <WifiOff size={11} />}
            {backendUp ? 'Alerts API connected' : 'Demo mode'}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
            background: connected ? 'var(--green-bg)' : 'var(--bg3)',
            border: `1px solid ${connected ? 'var(--green-border)' : 'var(--border)'}`,
            color: connected ? 'var(--green)' : 'var(--text2)',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--text3)', display: 'inline-block' }} />
            {connected ? 'WS live' : 'WS offline'}
          </div>

          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Edges in scope', value: stats.totalTransactions.toLocaleString(), icon: <Activity size={16} />, color: 'var(--accent)' },
          { label: 'Fraud alerts', value: stats.totalAlerts, icon: <AlertTriangle size={16} />, color: 'var(--amber)' },
          { label: 'High risk', value: stats.highRisk, icon: <Shield size={16} />, color: 'var(--red)' },
          { label: 'Avg fraud score', value: stats.avgFraudScore.toFixed(2), icon: <TrendingUp size={16} />, color: 'var(--purple)' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{label}</div>
              <div style={{ color, opacity: 0.8 }}>{icon}</div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '12px' }}>
            Alert graph from backend `graph_data`
          </div>
          <div style={{ height: '320px' }}>
            <GraphView
              graphData={selectedAlert?.graphData}
              loading={loading}
              error={loadError}
            />
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>Fraud alerts</div>
            {liveAlerts.length > 0 && (
              <div style={{ fontSize: '10px', color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', padding: '2px 8px', borderRadius: '4px' }}>
                +{liveAlerts.length} live
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                style={{
                  padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                  background: filter === option ? `${FILTER_COLORS[option]}18` : 'transparent',
                  border: `1px solid ${filter === option ? FILTER_COLORS[option] + '44' : 'var(--border)'}`,
                  color: filter === option ? FILTER_COLORS[option] : 'var(--text2)',
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading
              ? <div style={{ color: 'var(--text2)', fontSize: '12px', textAlign: 'center', padding: '40px 0' }}>Loading alerts...</div>
              : filtered.length === 0
                ? <div style={{ color: 'var(--text2)', fontSize: '12px', textAlign: 'center', padding: '40px 0' }}>No alerts available for this filter</div>
                : filtered.map((alert) => (
                    <FraudAlertCard
                      key={alert.transactionId || alert.id}
                      alert={alert}
                      onClick={setSelected}
                      isSelected={selectedAlert?.transactionId === alert.transactionId}
                    />
                  ))}
          </div>
        </div>
      </div>

      {selectedAlert && (
        <FraudDetailModal
          alert={selectedAlert}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
