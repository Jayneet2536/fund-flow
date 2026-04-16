import React from 'react';

const TYPO_CLASS = {
  'Fan-Out':     'fan-out',
  'Fan-In':      'fan-in',
  'Round-Trip':  'round-trip',
  'Mutual':      'mutual',
  'Structuring': 'structuring',
  'Dormant':     'dormant',
  'Legitimate':  'legitimate',
};

const TYPO_ICON = {
  'Fan-Out':     '🔀',
  'Fan-In':      '🔁',
  'Round-Trip':  '🔄',
  'Mutual':      '↔️',
  'Structuring': '📊',
  'Dormant':     '💤',
  'Legitimate':  '✅',
};

export default function TypologyTag({ typology }) {
  const cls = TYPO_CLASS[typology] || 'legitimate';
  const icon = TYPO_ICON[typology] || '❓';
  return (
    <span className={`typology-tag ${cls}`}>
      <span>{icon}</span>
      {typology}
    </span>
  );
}
