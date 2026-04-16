/* API Service — connects to Spring Boot backend */

const API_BASE = '/api';

export async function fetchAlerts(limit = 50) {
  try {
    const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend not available, using demo data:', err.message);
    return null;
  }
}

export async function sendTransaction(transaction) {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function generateReport(transactionId, body) {
  const res = await fetch(`${API_BASE}/alerts/${transactionId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/* ── DEMO DATA ─────────────────────────────────────────────────────
   Used when backend isn't running so the UI remains fully functional */

const NAMES = [
  'Rajesh Kumar','Priya Sharma','Amit Patel','Sunita Verma','Vijay Singh',
  'Meera Nair','Arjun Mehta','Kavitha Rao','Suresh Iyer','Deepa Krishnan',
  'Ravi Gupta','Anita Joshi','Manoj Tiwari','Pooja Agarwal','Sanjay Desai',
];

function randomName() { return NAMES[Math.floor(Math.random() * NAMES.length)]; }
function randomAcc() { return `ACC_${String(Math.floor(Math.random()*30)+1).padStart(3,'0')}`; }
function randomAmount() { return Math.floor(Math.random() * 5000000) + 100000; }

const TYPOLOGIES = ['Fan-Out','Fan-In','Round-Trip','Mutual','Structuring','Dormant'];
const RISK_LEVELS = ['HIGH','MEDIUM','LOW-MEDIUM'];
const PAYMENT_FMTS = ['NEFT','RTGS','IMPS','UPI','Cheque'];

function generateDemoAlert(i) {
  const typology = TYPOLOGIES[i % TYPOLOGIES.length];
  const riskLevel = RISK_LEVELS[i % RISK_LEVELS.length];
  const fraudScore = riskLevel === 'HIGH' ? 0.75 + Math.random()*0.2
                   : riskLevel === 'MEDIUM' ? 0.5 + Math.random()*0.24
                   : 0.3 + Math.random()*0.19;

  const nodeCount = 3 + Math.floor(Math.random() * 4);
  const nodes = [];
  const edges = [];
  const accounts = [];

  for (let n = 0; n < nodeCount; n++) {
    const accId = randomAcc();
    const name = randomName();
    accounts.push(accId);
    nodes.push({
      id: accId,
      name: name,
      fraud_score: fraudScore * (0.7 + Math.random()*0.5),
      is_suspect: Math.random() > 0.4,
      total_sent: randomAmount(),
      total_received: randomAmount(),
      is_new: Math.random() > 0.7,
      dormancy: Math.random() * 0.5,
    });
  }

  const edgeCount = nodeCount - 1 + Math.floor(Math.random() * 2);
  for (let e = 0; e < edgeCount; e++) {
    const srcIdx = e % nodeCount;
    const tgtIdx = (e + 1) % nodeCount;
    edges.push({
      source: nodes[srcIdx].id,
      target: nodes[tgtIdx].id,
      amount: randomAmount(),
      currency: 'INR',
      timestamp: new Date(Date.now() - Math.random()*7200000).toISOString().slice(0,19),
      payment_format: PAYMENT_FMTS[Math.floor(Math.random()*PAYMENT_FMTS.length)],
      suspicion: fraudScore * (0.8 + Math.random()*0.3),
      is_trigger: e === 0,
    });
  }

  const evidenceChain = edges.map((e,idx) => ({
    step: idx+1,
    from_account: e.source,
    from_name: nodes.find(n=>n.id===e.source)?.name || 'Unknown',
    to_account: e.target,
    to_name: nodes.find(n=>n.id===e.target)?.name || 'Unknown',
    amount: e.amount,
    currency: 'INR',
    timestamp: e.timestamp,
    payment_format: e.payment_format,
    suspicion_score: e.suspicion,
  }));

  const now = new Date(Date.now() - i * 300000);
  return {
    id: `TXN-${Date.now()}-${i}`,
    timestamp: now.toISOString().slice(0,19),
    typology,
    risk_level: riskLevel,
    fraud_score: Math.round(fraudScore * 10000) / 10000,
    trigger_transaction_id: `TXN-${Date.now()}-${i}`,
    graph_data: { nodes, edges },
    evidence_chain: evidenceChain,
    risk_breakdown: {
      base_gnn_score: Math.round((fraudScore * 0.7) * 1000) / 1000,
      amount_factor: 1.0 + Math.random() * 0.3,
      velocity_factor: 1.0 + Math.random() * 0.4,
      account_age_factor: 1.0 + Math.random() * 0.2,
      night_factor: 1.0 + Math.random() * 0.1,
      typology_factor: 1.0 + Math.random() * 0.15,
      total_amount_inr: edges.reduce((s,e) => s + e.amount, 0),
      time_span_hours: Math.round(Math.random() * 24 * 10) / 10,
    },
    total_amount: edges.reduce((s,e) => s + e.amount, 0),
    accounts_involved: accounts,
  };
}

export function generateDemoAlerts(count = 15) {
  return Array.from({ length: count }, (_, i) => generateDemoAlert(i));
}

export function generateDemoReport(alert) {
  return {
    report_id: `STR-${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}`,
    generated_at: new Date().toISOString(),
    reporting_entity: 'Demo Bank Ltd - Main Branch',
    typology: alert.typology,
    risk_level: alert.risk_level,
    nature_of_suspicion: `${alert.typology} pattern detected involving ${alert.accounts_involved?.length || 0} accounts with total exposure of ₹${(alert.total_amount || 0).toLocaleString('en-IN')}. The transaction pattern exhibits characteristics consistent with money laundering activities under PMLA 2002 Section 3. Automated GNN analysis assigned a risk score of ${alert.fraud_score}, warranting immediate investigation.`,
    fund_trail_narrative: (alert.evidence_chain || []).map((s,i) =>
      `Step ${i+1}: ₹${s.amount?.toLocaleString('en-IN')} transferred from ${s.from_name} (${s.from_account}) to ${s.to_name} (${s.to_account}) via ${s.payment_format} at ${s.timestamp}`
    ).join('. '),
    aggravating_factors: [
      'Multiple rapid-fire transactions within short time window',
      `Total amount of ₹${(alert.total_amount || 0).toLocaleString('en-IN')} exceeds reporting threshold`,
      `${alert.typology} pattern matches known money laundering typology`,
      'Involvement of accounts with unusual transaction patterns',
    ],
    recommended_action: 'File STR with FIU-IND immediately. Freeze all involved accounts pending investigation. Request enhanced KYC documentation. Escalate to compliance officer for regulatory reporting.',
    total_amount_involved: alert.total_amount || 0,
    accounts_involved: alert.accounts_involved || [],
    transaction_count: alert.evidence_chain?.length || 0,
    time_span_description: `${(alert.risk_breakdown?.time_span_hours || 0).toFixed(1)} hours`,
    evidence_chain: (alert.evidence_chain || []).map((s,i) => ({
      step: i+1,
      from: s.from_account,
      to: s.to_account,
      amount: s.amount,
      timestamp: s.timestamp,
      payment_format: s.payment_format,
    })),
  };
}
