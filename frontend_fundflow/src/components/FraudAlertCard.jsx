import React from 'react'
import { Clock, ArrowRight } from 'lucide-react'

const RISK_STYLES = {
  HIGH: { color: 'var(--red)', bg: 'var(--red-bg)', border: 'var(--red-border)' },
  MEDIUM: { color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber-border)' },
  'LOW-MEDIUM': { color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber-border)' },
  LOW: { color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green-border)' },
}

const TYPOLOGY_ICONS = {
  'Round-Trip': 'RT',
  'Fan-Out': 'FO',
  'Fan-In': 'FI',
  Structuring: 'ST',
  Dormant: 'DA',
  Mutual: 'MU',
  Legitimate: 'OK',
}

export default function FraudAlertCard({ alert, onClick, isSelected }) {
  const risk = RISK_STYLES[alert.riskLevel] || RISK_STYLES.LOW

  return (
    <div
      onClick={() => onClick(alert)}
      style={{
        background: isSelected ? 'var(--bg3)' : 'var(--bg2)',
        border: `1px solid ${isSelected ? risk.border : 'var(--border)'}`,
        borderRadius: '10px',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        marginBottom: '8px',
      }}
      onMouseEnter={(event) => {
        if (!isSelected) event.currentTarget.style.borderColor = 'var(--border2)'
      }}
      onMouseLeave={(event) => {
        if (!isSelected) event.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            background: risk.bg,
            border: `1px solid ${risk.border}`,
            color: risk.color,
            width: '28px', height: '28px',
            borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {TYPOLOGY_ICONS[alert.typology] || '?'}
          </span>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>
              {alert.transactionId}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '1px' }}>
              {alert.typology}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '11px', fontWeight: 600,
            color: risk.color,
            background: risk.bg,
            border: `1px solid ${risk.border}`,
            padding: '2px 8px', borderRadius: '4px',
          }}>
            {alert.riskLevel}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px', fontFamily: 'var(--mono)' }}>
            {((alert.fraudScore ?? 0) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '11px', color: 'var(--text2)' }}>
        <span style={{ fontFamily: 'var(--mono)' }}>{alert.senderAccount}</span>
        <ArrowRight size={10} />
        <span style={{ fontFamily: 'var(--mono)' }}>{alert.receiverAccount}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Clock size={10} /> {alert.timestamp}
        </span>
      </div>

      <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>
        {alert.currency || 'INR'} {Number(alert.amount ?? 0).toLocaleString('en-IN')}
        <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: '6px', fontSize: '11px' }}>
          via {alert.paymentType || 'NEFT'}
        </span>
      </div>
    </div>
  )
}
