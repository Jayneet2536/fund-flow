import React from 'react';

function formatAmount(amt) {
  if (!amt) return '₹0';
  return `₹${amt.toLocaleString('en-IN')}`;
}

export default function EvidenceChain({ chain }) {
  if (!chain || chain.length === 0) return <p className="empty-state">No evidence chain available</p>;

  return (
    <div className="evidence-chain">
      {chain.map((step, i) => {
        const isSuspicious = (step.suspicion_score || 0) > 0.6;
        return (
          <div key={i} className={`evidence-step ${isSuspicious ? 'suspicious' : ''}`}>
            <div className="evidence-step-num">{step.step || i + 1}</div>
            <div className="evidence-step-content">
              <div className="evidence-step-flow">
                <strong style={{ color: 'var(--text-primary)' }}>
                  {step.from_name || step.from_account}
                </strong>
                <span style={{ color: 'var(--accent-blue)', margin: '0 8px' }}>→</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {step.to_name || step.to_account}
                </strong>
                <span style={{
                  marginLeft: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: isSuspicious ? 'var(--risk-critical)' : 'var(--text-primary)',
                }}>
                  {formatAmount(step.amount)}
                </span>
              </div>
              <div className="evidence-step-meta">
                <span>🕐 {step.timestamp}</span>
                <span>💳 {step.payment_format}</span>
                {step.suspicion_score != null && (
                  <span style={{ color: isSuspicious ? 'var(--risk-critical)' : 'var(--text-muted)' }}>
                    ⚠ {(step.suspicion_score * 100).toFixed(0)}% risk
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
