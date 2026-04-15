import axios from 'axios'

const API = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

function toRiskLevel(score) {
  if (score >= 0.75) return 'HIGH'
  if (score >= 0.5) return 'MEDIUM'
  if (score >= 0.3) return 'LOW-MEDIUM'
  return 'LOW'
}

function normalizeGraphData(graphData) {
  if (!graphData) return { nodes: [], edges: [] }

  const nodes = Array.isArray(graphData.nodes)
    ? graphData.nodes.map((node) => {
        const fraudScore = Number(node.fraud_score ?? node.fraudScore ?? 0)
        return {
          id: node.id,
          name: node.name ?? node.id,
          label: node.name ?? node.id,
          fraudScore,
          riskLevel: toRiskLevel(fraudScore),
          isSuspect: Boolean(node.is_suspect ?? node.isSuspect),
          totalSent: Number(node.total_sent ?? node.totalSent ?? 0),
          totalReceived: Number(node.total_received ?? node.totalReceived ?? 0),
          isNew: Boolean(node.is_new ?? node.isNew),
          dormancy: Number(node.dormancy ?? 0),
        }
      })
    : []

  const edges = Array.isArray(graphData.edges)
    ? graphData.edges.map((edge, index) => ({
        id: edge.id ?? `${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        amount: Number(edge.amount ?? 0),
        currency: edge.currency ?? 'INR',
        timestamp: edge.timestamp ?? '',
        paymentFormat: edge.payment_format ?? edge.paymentFormat ?? 'NEFT',
        suspicion: Number(edge.suspicion ?? 0),
        isTrigger: Boolean(edge.is_trigger ?? edge.isTrigger),
      }))
    : []

  return { nodes, edges }
}

function formatEvidenceStep(step) {
  if (typeof step === 'string') return step

  if (!step || typeof step !== 'object') return 'Unknown evidence step'

  const from = step.from_name || step.from_account || step.from || 'Unknown'
  const to = step.to_name || step.to_account || step.to || 'Unknown'
  const amount = Number(step.amount ?? 0).toLocaleString('en-IN')
  const payment = step.payment_format || step.paymentFormat || 'NEFT'

  return `${from} -> ${to} | INR ${amount} | ${payment}`
}

export function normalizeAlert(rawAlert) {
  const graphData = normalizeGraphData(rawAlert.graph_data ?? rawAlert.graphData)
  const triggerEdge =
    graphData.edges.find((edge) => edge.isTrigger) ??
    graphData.edges[graphData.edges.length - 1] ??
    null

  const uniqueAccounts = Array.isArray(rawAlert.accounts_involved)
    ? rawAlert.accounts_involved
    : Array.isArray(rawAlert.accountsInvolved)
      ? rawAlert.accountsInvolved
      : []

  return {
    id: rawAlert.id ?? rawAlert.trigger_transaction_id ?? rawAlert.triggerTransactionId,
    transactionId: rawAlert.trigger_transaction_id ?? rawAlert.triggerTransactionId ?? rawAlert.id,
    timestamp: rawAlert.timestamp ?? '',
    typology: rawAlert.typology ?? 'Unknown',
    riskLevel: rawAlert.risk_level ?? rawAlert.riskLevel ?? 'LOW',
    fraudScore: Number(rawAlert.fraud_score ?? rawAlert.fraudScore ?? 0),
    rawGnnScore: Number(rawAlert.raw_gnn_score ?? rawAlert.rawGnnScore ?? 0),
    confidence: Number(rawAlert.confidence ?? 0),
    latencyMs: Number(rawAlert.latency_ms ?? rawAlert.latencyMs ?? 0),
    totalAmount: Number(rawAlert.total_amount ?? rawAlert.totalAmount ?? triggerEdge?.amount ?? 0),
    amount: Number(rawAlert.trigger_amount ?? rawAlert.triggerAmount ?? triggerEdge?.amount ?? rawAlert.total_amount ?? rawAlert.totalAmount ?? 0),
    currency: rawAlert.trigger_currency ?? rawAlert.triggerCurrency ?? triggerEdge?.currency ?? 'INR',
    paymentType: rawAlert.payment_format ?? rawAlert.paymentFormat ?? triggerEdge?.paymentFormat ?? 'NEFT',
    senderAccount: rawAlert.from_account ?? rawAlert.fromAccount ?? triggerEdge?.source ?? uniqueAccounts[0] ?? 'Unknown',
    receiverAccount: rawAlert.to_account ?? rawAlert.toAccount ?? triggerEdge?.target ?? uniqueAccounts[1] ?? 'Unknown',
    graphData,
    graphHops: graphData.edges.length,
    accountsInvolved: uniqueAccounts,
    accountCount: uniqueAccounts.length || graphData.nodes.length,
    evidenceChain: Array.isArray(rawAlert.evidence_chain ?? rawAlert.evidenceChain)
      ? (rawAlert.evidence_chain ?? rawAlert.evidenceChain).map(formatEvidenceStep)
      : [],
    rawEvidenceChain: Array.isArray(rawAlert.evidence_chain ?? rawAlert.evidenceChain)
      ? rawAlert.evidence_chain ?? rawAlert.evidenceChain
      : [],
    riskBreakdown: rawAlert.risk_breakdown ?? rawAlert.riskBreakdown ?? {},
  }
}

function buildReportRequest(alert) {
  return {
    score_result: {
      typology: alert.typology,
      risk_level: alert.riskLevel,
      fraud_score: alert.fraudScore,
      risk_breakdown: alert.riskBreakdown ?? {},
    },
    nodes: alert.graphData.nodes.map((node) => ({
      account_id: node.id,
      name: node.name,
      total_sent: node.totalSent ?? 0,
      total_received: node.totalReceived ?? 0,
      tx_count_out: 0,
      tx_count_in: 0,
      unique_counterparts: 0,
      is_new_account: node.isNew ?? false,
      dormancy_score: node.dormancy ?? 0,
      last_tx_timestamp: null,
      first_tx_timestamp: null,
    })),
    edges: alert.graphData.edges.map((edge, index) => ({
      edge_id: edge.id ?? `${edge.source}-${edge.target}-${index}`,
      from_account: edge.source,
      to_account: edge.target,
      amount: edge.amount,
      currency: edge.currency ?? 'INR',
      payment_format: edge.paymentFormat ?? 'NEFT',
      timestamp: edge.timestamp,
      is_trigger: edge.isTrigger ?? false,
    })),
    reporting_entity: 'Demo Bank Ltd',
    branch: 'Main Branch',
  }
}

function normalizeReport(rawReport) {
  if (!rawReport || typeof rawReport !== 'object') return rawReport

  return {
    ...rawReport,
    generatedAt: rawReport.generated_at ?? rawReport.generatedAt,
    reportingEntity: rawReport.reporting_entity ?? rawReport.reportingEntity,
    riskLevel: rawReport.risk_level ?? rawReport.riskLevel,
    totalAmountInvolved: rawReport.total_amount_involved ?? rawReport.totalAmountInvolved,
    accountsInvolved: rawReport.accounts_involved ?? rawReport.accountsInvolved ?? [],
    transactionCount: rawReport.transaction_count ?? rawReport.transactionCount,
    timeSpanDescription: rawReport.time_span_description ?? rawReport.timeSpanDescription,
  }
}

export async function getAlerts() {
  const response = await API.get('/alerts')
  return {
    ...response,
    data: Array.isArray(response.data) ? response.data.map(normalizeAlert) : [],
  }
}

export async function getAlertById(transactionId) {
  const response = await API.get(`/alerts/${transactionId}`)
  return {
    ...response,
    data: normalizeAlert(response.data),
  }
}

export async function generateReport(alert) {
  const response = await API.post(
    `/alerts/${alert.transactionId}/report`,
    buildReportRequest(alert),
  )

  return {
    ...response,
    data: normalizeReport(response.data),
  }
}

export { normalizeGraphData, normalizeReport }
export default API
