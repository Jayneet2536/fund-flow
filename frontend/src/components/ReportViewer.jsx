import React, { useState } from 'react';
import RiskBadge from './RiskBadge';
import TypologyTag from './TypologyTag';
import EvidenceChain from './EvidenceChain';
import { generateDemoReport } from '../services/api';

function formatAmount(amt) {
  if (!amt) return '₹0';
  return `₹${Math.round(amt).toLocaleString('en-IN')}`;
}

export default function ReportViewer({ alert, alerts }) {
  const [currentAlert, setCurrentAlert] = useState(alert || alerts?.[0] || null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!currentAlert) return;
    setLoading(true);
    try {
      // Try backend first, fall back to demo
      const resp = await fetch(`/api/alerts/${currentAlert.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score_result: currentAlert,
          nodes: currentAlert.graph_data?.nodes || [],
          edges: currentAlert.graph_data?.edges || [],
        }),
      });
      if (resp.ok) {
        setReport(await resp.json());
      } else {
        throw new Error('Backend unavailable');
      }
    } catch {
      // Demo fallback
      setReport(generateDemoReport(currentAlert));
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <h2>STR Reports</h2>
        <p>Generate FIU-IND Suspicious Transaction Reports for compliance filing</p>
      </div>

      {/* Alert selector + Generate */}
      <div className="filter-bar">
        <select
          id="report-alert-select"
          value={currentAlert?.id || ''}
          onChange={e => {
            const a = alerts.find(x => x.id === e.target.value);
            if (a) { setCurrentAlert(a); setReport(null); }
          }}
          style={{ minWidth: 300 }}
        >
          {(alerts || []).map(a => (
            <option key={a.id} value={a.id}>
              {a.typology} — {formatAmount(a.total_amount)} — {a.risk_level}
            </option>
          ))}
        </select>
        <button
          id="generate-report-btn"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading || !currentAlert}
        >
          {loading ? (
            <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</>
          ) : (
            <>📄 Generate STR Report</>
          )}
        </button>
      </div>

      {/* Report Display */}
      {report ? (
        <div className="report-container">
          <div className="glass-card">
            {/* Header */}
            <div className="report-header">
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Suspicious Transaction Report
              </div>
              <h3>FIU-IND STR Filing</h3>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
                <TypologyTag typology={report.typology} />
                <RiskBadge level={report.risk_level} />
              </div>
            </div>

            {/* Meta grid */}
            <div className="report-section">
              <h4>Report Information</h4>
              <div className="report-meta-grid">
                <div className="report-meta-item">
                  <div className="label">Report ID</div>
                  <div className="value" style={{ color: 'var(--accent-blue)' }}>{report.report_id}</div>
                </div>
                <div className="report-meta-item">
                  <div className="label">Generated At</div>
                  <div className="value">{new Date(report.generated_at).toLocaleString('en-IN')}</div>
                </div>
                <div className="report-meta-item">
                  <div className="label">Reporting Entity</div>
                  <div className="value">{report.reporting_entity}</div>
                </div>
                <div className="report-meta-item">
                  <div className="label">Time Span</div>
                  <div className="value">{report.time_span_description}</div>
                </div>
                <div className="report-meta-item">
                  <div className="label">Total Amount</div>
                  <div className="value" style={{ color: 'var(--risk-critical)' }}>
                    {formatAmount(report.total_amount_involved)}
                  </div>
                </div>
                <div className="report-meta-item">
                  <div className="label">Transactions</div>
                  <div className="value">{report.transaction_count}</div>
                </div>
                <div className="report-meta-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="label">Accounts Involved</div>
                  <div className="value" style={{ fontSize: '0.82rem' }}>
                    {(report.accounts_involved || []).join(', ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Nature of Suspicion */}
            <div className="report-section">
              <h4>Nature of Suspicion</h4>
              <p>{report.nature_of_suspicion}</p>
            </div>

            {/* Fund Trail Narrative */}
            <div className="report-section">
              <h4>Fund Trail Narrative</h4>
              <p>{report.fund_trail_narrative}</p>
            </div>

            {/* Aggravating Factors */}
            <div className="report-section">
              <h4>Aggravating Factors</h4>
              <ul className="report-factors-list">
                {(report.aggravating_factors || []).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            {/* Evidence Chain */}
            <div className="report-section">
              <h4>Evidence Chain</h4>
              {currentAlert?.evidence_chain ? (
                <EvidenceChain chain={currentAlert.evidence_chain} />
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No evidence chain available</p>
              )}
            </div>

            {/* Recommended Action */}
            <div className="report-section">
              <h4>Recommended Action</h4>
              <div style={{
                padding: 'var(--space-md)',
                background: 'rgba(255,45,85,0.06)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255,45,85,0.15)',
                color: 'var(--text-secondary)',
                lineHeight: 1.8,
              }}>
                {report.recommended_action}
              </div>
            </div>

            {/* Print button */}
            <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-ghost" onClick={() => window.print()}>
                🖨️ Print Report
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card">
          <div className="empty-state">
            <div className="icon">📄</div>
            <p>Select an alert and click "Generate STR Report"</p>
            <p style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-muted)' }}>
              Reports are generated using AI-powered narrative generation and FIU-IND STR format
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
