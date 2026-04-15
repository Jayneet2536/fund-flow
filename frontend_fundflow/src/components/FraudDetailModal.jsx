import React, { useEffect, useMemo, useState } from 'react'
import { X, FileText, AlertTriangle, CheckCircle, Loader } from 'lucide-react'
import { generateReport, getAlertById } from '../api'

function formatMetric(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : 'N/A'
}

function formatRiskBreakdown(riskBreakdown) {
  if (!riskBreakdown || typeof riskBreakdown !== 'object') return []

  const LABELS = {
    base_gnn_score: 'Base GNN score',
    amount_factor: 'Amount factor',
    velocity_factor: 'Velocity factor',
    account_age_factor: 'Account age factor',
    night_factor: 'Night factor',
    typology_factor: 'Typology factor',
    total_amount_inr: 'Total amount',
    time_span_hours: 'Time span',
    reason: 'Reason',
  }

  return Object.entries(riskBreakdown)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      if (key === 'total_amount_inr') {
        return [LABELS[key] ?? key, `INR ${Number(value).toLocaleString('en-IN')}`]
      }

      if (key === 'time_span_hours') {
        return [LABELS[key] ?? key, `${formatMetric(Number(value))} hrs`]
      }

      return [LABELS[key] ?? key.replace(/_/g, ' '), typeof value === 'number' ? formatMetric(value, 3) : String(value)]
    })
}

export default function FraudDetailModal({ alert, onClose }) {
  const [reportLoading, setReportLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [reportError, setReportError] = useState(null)
  const [latestAlert, setLatestAlert] = useState(alert)

  useEffect(() => {
    let active = true
    setLatestAlert(alert)

    async function hydrateAlert() {
      try {
        const response = await getAlertById(alert.transactionId)
        if (active) setLatestAlert(response.data)
      } catch {
        if (active) setLatestAlert(alert)
      }
    }

    if (alert?.transactionId) hydrateAlert()

    return () => {
      active = false
    }
  }, [alert])

  if (!latestAlert) return null

  const riskColor = {
    HIGH: 'var(--red)',
    MEDIUM: 'var(--amber)',
    LOW: 'var(--green)',
    'LOW-MEDIUM': 'var(--amber)',
  }[latestAlert.riskLevel] || 'var(--text2)'

  const handleGenerateReport = async () => {
    setReportLoading(true)
    setReportError(null)

    try {
      const response = await generateReport(latestAlert)
      setReport(response.data)
    } catch {
      setReportError('Failed to generate report. Check backend and inference service.')
    } finally {
      setReportLoading(false)
    }
  }

  const detailRows = [
    ['Sender', latestAlert.senderAccount],
    ['Receiver', latestAlert.receiverAccount],
    ['Trigger Amount', `${latestAlert.currency || 'INR'} ${Number(latestAlert.amount).toLocaleString('en-IN')}`],
    ['Total Pattern Amount', `${latestAlert.currency || 'INR'} ${Number(latestAlert.totalAmount ?? latestAlert.amount ?? 0).toLocaleString('en-IN')}`],
    ['Payment Type', latestAlert.paymentType],
    ['Timestamp', latestAlert.timestamp],
    ['Graph edges', latestAlert.graphHops || 0],
    ['Accounts involved', latestAlert.accountCount || latestAlert.accountsInvolved?.length || 0],
    ['Alert ID', latestAlert.transactionId],
    ['Trigger Currency', latestAlert.currency || 'INR'],
  ]

  const modelRows = [
    ['Model confidence', `${formatMetric(latestAlert.confidence * 100, 1)}%`],
    ['Raw GNN score', formatMetric(latestAlert.rawGnnScore, 4)],
    ['Final fraud score', formatMetric(latestAlert.fraudScore, 4)],
    ['Inference latency', `${formatMetric(latestAlert.latencyMs, 0)} ms`],
  ]

  const breakdownRows = useMemo(() => formatRiskBreakdown(latestAlert.riskBreakdown), [latestAlert.riskBreakdown])
  const graphNodes = latestAlert.graphData?.nodes ?? []
  const highlightedNodes = graphNodes.filter((node) => node.isNew || Number(node.dormancy ?? 0) > 0.5)

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px',
      }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: '16px',
        width: '100%', maxWidth: '760px',
        maxHeight: '90vh', overflowY: 'auto',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text2)' }}>Alert Detail</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', marginTop: '2px' }}>
              {latestAlert.transactionId}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '6px', color: 'var(--text2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '16px', marginBottom: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>FRAUD SCORE</div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: riskColor, fontFamily: 'var(--mono)' }}>
              {(latestAlert.fraudScore * 100).toFixed(1)}%
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>RISK LEVEL</div>
            <div style={{
              fontSize: '16px', fontWeight: 600, color: riskColor,
              background: `${riskColor}18`,
              border: `1px solid ${riskColor}44`,
              padding: '4px 14px', borderRadius: '6px',
            }}>
              {latestAlert.riskLevel}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>PATTERN</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{latestAlert.typology}</div>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '8px', marginBottom: '16px',
        }}>
          {detailRows.map(([label, value]) => (
            <div
              key={label}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--mono)', marginTop: '3px' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
          gap: '8px', marginBottom: '16px',
        }}>
          {modelRows.map(([label, value]) => (
            <div
              key={label}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '12px',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: '15px', color: 'var(--text)', fontFamily: 'var(--mono)', marginTop: '6px', fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>

        {latestAlert.accountsInvolved?.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Accounts Involved
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {latestAlert.accountsInvolved.map((accountId) => (
                <div key={accountId} style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: '999px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  color: 'var(--text)',
                  fontFamily: 'var(--mono)',
                }}>
                  {accountId}
                </div>
              ))}
            </div>
          </div>
        )}

        {highlightedNodes.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Node Flags
            </div>
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '12px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
            }}>
              {highlightedNodes.map((node) => (
                <div key={node.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{node.id}</span>
                  <span style={{ color: 'var(--text2)' }}>
                    {node.isNew ? 'New account' : `Dormancy ${formatMetric(node.dormancy, 2)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {breakdownRows.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Risk Breakdown
            </div>
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '12px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
            }}>
              {breakdownRows.map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text2)' }}>{label}</span>
                  <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {latestAlert.evidenceChain?.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Evidence Chain
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
              {latestAlert.evidenceChain.map((step, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: index < latestAlert.evidenceChain.length - 1 ? '8px' : 0 }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                    {index + 1}
                  </div>
                  <div style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text)' }}>{step}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Suspicious Transaction Report (STR)
          </div>

          {report ? (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--green-border)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--green)', fontSize: '12px' }}>
                <CheckCircle size={14} /> Report generated successfully
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.7 }}>
                {report.nature_of_suspicion}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.7, marginTop: '10px' }}>
                {report.fund_trail_narrative}
              </div>
              {Array.isArray(report.aggravating_factors) && report.aggravating_factors.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Aggravating Factors
                  </div>
                  {report.aggravating_factors.map((factor) => (
                    <div key={factor} style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>
                      - {factor}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Recommended action</div>
                <div style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{report.recommended_action || 'N/A'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Time span</div>
                <div style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{report.timeSpanDescription || 'N/A'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Transaction count</div>
                <div style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{report.transactionCount ?? 'N/A'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>Accounts in report</div>
                <div style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{report.accountsInvolved?.join(', ') || 'N/A'}</div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateReport}
              disabled={reportLoading || !latestAlert.graphData?.edges?.length}
              style={{
                width: '100%', padding: '10px',
                background: reportLoading ? 'var(--bg3)' : 'var(--accent)',
                border: '1px solid transparent',
                borderRadius: '8px', color: '#fff',
                fontSize: '13px', fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                opacity: reportLoading || !latestAlert.graphData?.edges?.length ? 0.7 : 1,
              }}
            >
              {reportLoading
                ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating STR...</>
                : <><FileText size={14} /> Generate STR Report</>
              }
            </button>
          )}

          {reportError && (
            <div style={{ marginTop: '8px', color: 'var(--red)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={12} /> {reportError}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
