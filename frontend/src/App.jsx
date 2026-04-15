import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const API_BASE_URL = "http://localhost:8080/api";
const WS_URL = "http://localhost:8080/ws";
const PAGE_LIMIT = 10;
const DEFAULT_REPORT_MESSAGE =
  "Generate a report from the selected alert to preview the backend report flow.";
const DETAIL_EMPTY_MESSAGE =
  "Select an alert to inspect graph details, evidence, and reporting actions.";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "Unknown time";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getRiskClass(riskLevel = "") {
  const upper = riskLevel.toUpperCase();
  if (upper.includes("HIGH")) return "chip-high";
  if (upper.includes("MEDIUM")) return "chip-medium";
  return "chip-low";
}

function buildReportPayload(alert) {
  const graphData = alert.graph_data || {};
  const graphNodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const graphEdges = Array.isArray(graphData.edges) ? graphData.edges : [];

  const nodes =
    Array.isArray(alert.nodes) && alert.nodes.length > 0
      ? alert.nodes
      : graphNodes.map((node) => ({
          account_id: node.id,
          name: node.name || "Unknown",
          total_sent: Number(node.total_sent || 0),
          total_received: Number(node.total_received || 0),
          tx_count_out: Number(node.tx_count_out || 0),
          tx_count_in: Number(node.tx_count_in || 0),
          unique_counterparts: Number(node.unique_counterparts || 0),
          is_new_account: Boolean(node.is_new),
          dormancy_score: Number(node.dormancy || 0),
          last_tx_timestamp: null,
          first_tx_timestamp: null,
        }));

  const edges =
    Array.isArray(alert.edges) && alert.edges.length > 0
      ? alert.edges
      : graphEdges.map((edge, index) => ({
          edge_id: `graph-edge-${index + 1}`,
          from_account: edge.source,
          to_account: edge.target,
          amount: Number(edge.amount || 0),
          currency: edge.currency || "INR",
          payment_format: edge.payment_format || "NEFT",
          timestamp: edge.timestamp || new Date().toISOString(),
          is_trigger: Boolean(edge.is_trigger),
        }));

  return {
    score_result: {
      trigger_transaction_id: alert.trigger_transaction_id,
      is_fraud: true,
      typology: alert.typology,
      risk_level: alert.risk_level,
      fraud_score: Number(alert.fraud_score || 0),
      raw_gnn_score: Number(alert.raw_gnn_score || 0),
      confidence: Number(alert.confidence || 0),
      latency_ms: Number(alert.latency_ms || 0),
      evidence_chain: alert.evidence_chain || [],
      graph_data: alert.graph_data || { nodes: [], edges: [] },
      risk_breakdown: alert.risk_breakdown || {},
    },
    nodes,
    edges,
    reporting_entity: "Demo Bank Ltd",
    branch: "Main Branch",
  };
}

function MetricCard({ label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AlertList({ alerts, selectedAlertId, onSelect }) {
  return (
    <div className="alert-list">
      {alerts.map((alert) => (
        <button
          key={alert.id}
          type="button"
          className={`alert-item ${
            alert.id === selectedAlertId ? "active" : ""
          }`}
          onClick={() => onSelect(alert.id)}
        >
          <div className="alert-topline">
            <div>
              <h3>{alert.typology || "Unknown Typology"}</h3>
              <p className="alert-route">
                {alert.trigger_transaction_id || alert.id}
              </p>
            </div>
            <span className={`chip ${getRiskClass(alert.risk_level)}`}>
              {alert.risk_level || "UNKNOWN"}
            </span>
          </div>

          <div className="chip-row">
            <span className="chip">
              Score {Number(alert.fraud_score || 0).toFixed(2)}
            </span>
            <span className="chip">
              Exposure {formatCurrency(alert.total_amount || 0)}
            </span>
          </div>

          <div className="alert-route">{formatTimestamp(alert.timestamp)}</div>
        </button>
      ))}
    </div>
  );
}

function AlertDetail({ alert, reportLoading, onGenerateReport }) {
  if (!alert) {
    return <div className="detail-state">{DETAIL_EMPTY_MESSAGE}</div>;
  }

  const graphNodes = Array.isArray(alert.graph_data?.nodes)
    ? alert.graph_data.nodes
    : [];
  const graphEdges = Array.isArray(alert.graph_data?.edges)
    ? alert.graph_data.edges
    : [];
  const evidence = Array.isArray(alert.evidence_chain)
    ? alert.evidence_chain
    : [];
  const riskBreakdown = alert.risk_breakdown || {};
  const riskEntries = Object.entries(riskBreakdown);

  return (
    <div className="detail-stack">
      <section className="detail-section">
        <div className="detail-grid">
          <div>
            <span className="detail-label">Typology</span>
            <div className="detail-value strong-danger">
              {alert.typology || "Unknown"}
            </div>
          </div>
          <div>
            <span className="detail-label">Risk Level</span>
            <div className="detail-value">{alert.risk_level || "Unknown"}</div>
          </div>
          <div>
            <span className="detail-label">Fraud Score</span>
            <div className="detail-value">
              {Number(alert.fraud_score || 0).toFixed(2)}
            </div>
          </div>
          <div>
            <span className="detail-label">Raw GNN Score</span>
            <div className="detail-value">
              {Number(alert.raw_gnn_score || 0).toFixed(2)}
            </div>
          </div>
          <div>
            <span className="detail-label">Confidence</span>
            <div className="detail-value">
              {Number(alert.confidence || 0).toFixed(2)}
            </div>
          </div>
          <div>
            <span className="detail-label">Latency</span>
            <div className="detail-value">
              {Number(alert.latency_ms || 0).toFixed(0)} ms
            </div>
          </div>
          <div>
            <span className="detail-label">Graph Edges</span>
            <div className="detail-value">{graphEdges.length}</div>
          </div>
        </div>

        <div className="detail-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => onGenerateReport(alert)}
            disabled={reportLoading}
          >
            {reportLoading ? "Generating..." : "Generate STR Report"}
          </button>
        </div>
      </section>

      <section className="detail-section">
        <h3>Risk Breakdown</h3>
        <div className="detail-grid">
          {riskEntries.length > 0 ? (
            riskEntries.map(([key, value]) => (
              <div key={key} className="detail-card">
                <span className="detail-label">{key.replaceAll("_", " ")}</span>
                <div className="detail-value">
                  {typeof value === "number" ? value.toFixed(3) : String(value)}
                </div>
              </div>
            ))
          ) : (
            <div className="detail-state">No risk breakdown available.</div>
          )}
        </div>
      </section>

      <section className="detail-section">
        <h3>Graph Snapshot</h3>
        <div className="graph-list">
          {graphNodes.length > 0 ? (
            graphNodes.map((node, index) => (
              <article
                key={node.id || `${node.name || "node"}-${index}`}
                className="graph-node"
              >
                <span className="meta-label">{node.id}</span>
                <strong>{node.name || "Unknown"}</strong>
                <div className="chip-row">
                  <span className="chip">
                    Node score {Number(node.fraud_score || 0).toFixed(2)}
                  </span>
                  <span className="chip">
                    {node.is_new ? "New account" : "Established"}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="detail-state">No graph nodes available.</div>
          )}
        </div>
      </section>

      <section className="detail-section">
        <h3>Evidence Chain</h3>
        <div className="evidence-list">
          {evidence.length > 0 ? (
            evidence.map((step, index) => (
              <article
                key={`${step.step || index}-${step.from_account || "from"}-${
                  step.to_account || "to"
                }`}
                className="evidence-item"
              >
                <span className="meta-label">Step {step.step || "?"}</span>
                <strong>
                  {step.from_name || step.from_account} to{" "}
                  {step.to_name || step.to_account}
                </strong>
                <div className="chip-row">
                  <span className="chip">
                    {formatCurrency(step.amount || 0)}
                  </span>
                  <span className="chip">
                    {step.payment_format || "NEFT"}
                  </span>
                  <span className="chip">
                    Suspicion {Number(step.suspicion_score || 0).toFixed(2)}
                  </span>
                </div>
                <p className="alert-route">{formatTimestamp(step.timestamp)}</p>
              </article>
            ))
          ) : (
            <div className="detail-state">No evidence chain available.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [backendStatus, setBackendStatus] = useState("Connecting");
  const [connectionMode, setConnectionMode] = useState("WebSocket");
  const [lastRefresh, setLastRefresh] = useState("Waiting");
  const [reportOutput, setReportOutput] = useState(DEFAULT_REPORT_MESSAGE);
  const loadingRef = useRef(false);
  const reportLoadingRef = useRef(false);
  const stompClientRef = useRef(null);
  const isConnectedRef = useRef(false);
  const pageRef = useRef(page);
  const mountedRef = useRef(false);

  const selectedAlert =
    alerts.find((alert) => alert.id === selectedAlertId) || alerts[0] || null;

  const highRisk = alerts.filter((alert) =>
    String(alert.risk_level || "").toUpperCase().includes("HIGH")
  ).length;
  const typologies = new Set(alerts.map((alert) => alert.typology).filter(Boolean))
    .size;
  const exposure = alerts.reduce(
    (sum, alert) => sum + Number(alert.total_amount || 0),
    0
  );
  const visibleTotalPages = Math.max(totalPages, 1);
  const visiblePage = Math.min(page, visibleTotalPages);

  function applyAlertSnapshot(payload) {
    const nextAlerts = Array.isArray(payload?.items) ? payload.items : [];
    const nextTotal = Number(payload?.total || 0);
    const nextTotalPages = Number(
      payload?.total_pages ?? payload?.totalPages ?? 0
    );

    setAlerts(nextAlerts);
    setTotal(nextTotal);
    setTotalPages(nextTotalPages);
    setSelectedAlertId((currentSelectedAlertId) => {
      if (
        currentSelectedAlertId &&
        nextAlerts.some((alert) => alert.id === currentSelectedAlertId)
      ) {
        return currentSelectedAlertId;
      }

      return nextAlerts[0]?.id || null;
    });
    setBackendStatus("Connected");
    setConnectionMode("WebSocket");
    setLastRefresh(new Date().toLocaleTimeString("en-IN"));
  }

  async function loadAlertsHttpFallback(targetPage = pageRef.current) {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/alerts?page=${targetPage}&limit=${PAGE_LIMIT}`
      );
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = await response.json();
      applyAlertSnapshot(payload);
      setConnectionMode("HTTP fallback");
    } catch (error) {
      setAlerts([]);
      setSelectedAlertId(null);
      setTotal(0);
      setTotalPages(0);
      setBackendStatus("Offline");
      setLastRefresh("Failed");
      setReportOutput(error.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  function requestAlertSnapshot(targetPage = pageRef.current) {
    const client = stompClientRef.current;
    if (!client || !isConnectedRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    client.publish({
      destination: "/app/alerts.snapshot",
      body: JSON.stringify({
        page: targetPage,
        limit: PAGE_LIMIT,
      }),
    });
  }

  async function generateReport(alert) {
    if (!alert || reportLoadingRef.current) return;

    reportLoadingRef.current = true;
    setReportLoading(true);
    setReportOutput("Generating report...");

    try {
      const payload = buildReportPayload(alert);
      const response = await fetch(
        `${API_BASE_URL}/alerts/${encodeURIComponent(
          alert.trigger_transaction_id || alert.id
        )}/report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Report request failed with status ${response.status}`);
      }

      const result = await response.json();
      setReportOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setReportOutput(`Report generation failed: ${error.message}`);
    } finally {
      reportLoadingRef.current = false;
      setReportLoading(false);
    }
  }

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    mountedRef.current = true;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        stompClientRef.current = client;
        isConnectedRef.current = true;
        setBackendStatus("Connected");
        setConnectionMode("WebSocket");

        client.subscribe("/user/queue/alerts.snapshot", (message) => {
          try {
            const payload = JSON.parse(message.body);
            applyAlertSnapshot(payload);
          } catch (error) {
            setReportOutput(`Failed to parse alert snapshot: ${error.message}`);
          } finally {
            loadingRef.current = false;
            setLoading(false);
          }
        });

        client.subscribe("/topic/fraud-alerts", (message) => {
          try {
            JSON.parse(message.body);
            setBackendStatus("Connected");
            setConnectionMode("WebSocket");
            setLastRefresh(new Date().toLocaleTimeString("en-IN"));
            requestAlertSnapshot(pageRef.current);
          } catch (error) {
            setReportOutput(`Failed to parse live alert: ${error.message}`);
          }
        });

        requestAlertSnapshot(pageRef.current);
      },
      onStompError: (frame) => {
        isConnectedRef.current = false;
        setBackendStatus("Offline");
        setConnectionMode("HTTP fallback");
        setReportOutput(
          frame.headers.message || "WebSocket broker reported an error."
        );
        loadAlertsHttpFallback(pageRef.current);
      },
      onWebSocketClose: () => {
        isConnectedRef.current = false;
        if (mountedRef.current) {
          setBackendStatus("Reconnecting");
        }
      },
      onWebSocketError: () => {
        isConnectedRef.current = false;
        setBackendStatus("Offline");
        setConnectionMode("HTTP fallback");
        loadAlertsHttpFallback(pageRef.current);
      },
    });

    stompClientRef.current = client;
    client.activate();

    return () => {
      mountedRef.current = false;
      isConnectedRef.current = false;
      stompClientRef.current = null;
      client.deactivate();
    };
  }, []);

  useEffect(() => {
    if (isConnectedRef.current) {
      requestAlertSnapshot(page);
    }
  }, [page]);

  useEffect(() => {
    setReportOutput(DEFAULT_REPORT_MESSAGE);
  }, [selectedAlertId]);

  const detailMessage =
    backendStatus === "Offline"
      ? "The dashboard could not reach the backend. Start Spring Boot on port 8080 and refresh."
      : DETAIL_EMPTY_MESSAGE;

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">AML Detection Console</p>
          <h1>Fund Flow Intelligence Dashboard</h1>
          <p className="hero-copy">
            Live monitoring for suspicious transaction patterns, risk scoring,
            and evidence review.
          </p>
        </div>

        <div className="hero-status">
          <div className="status-card">
            <span className="status-label">Backend</span>
            <strong>{backendStatus}</strong>
          </div>
          <div className="status-card">
            <span className="status-label">Channel</span>
            <strong>{connectionMode}</strong>
          </div>
          <div className="status-card">
            <span className="status-label">Last Update</span>
            <strong>{lastRefresh}</strong>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>Recent Alert Stream</h2>
            </div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                if (isConnectedRef.current) {
                  requestAlertSnapshot(page);
                  return;
                }

                loadAlertsHttpFallback(page);
              }}
              disabled={loading}
            >
              {loading ? "Syncing..." : "Sync Now"}
            </button>
          </div>

          <div className="metrics">
            <MetricCard label="Total Alerts" value={String(total)} />
            <MetricCard label="High Risk" value={String(highRisk)} />
            <MetricCard label="Typologies" value={String(typologies)} />
            <MetricCard
              label="Total Exposure"
              value={formatCurrency(exposure)}
            />
          </div>

          {alerts.length > 0 ? (
            <AlertList
              alerts={alerts}
              selectedAlertId={selectedAlert?.id}
              onSelect={setSelectedAlertId}
            />
          ) : (
            <p className="empty-state">
              No fraud alerts yet. Start the backend services and send some
              transactions to populate the dashboard.
            </p>
          )}

          <div className="pagination">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPage((currentPage) => currentPage - 1)}
              disabled={loading || page <= 1}
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {visiblePage} of {visibleTotalPages} | {total} total
            </span>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={loading || totalPages === 0 || page >= totalPages}
            >
              Next
            </button>
          </div>
        </section>

        <aside className="sidebar">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Details</p>
                <h2>Selected Alert</h2>
              </div>
            </div>

            {backendStatus === "Offline" && !selectedAlert ? (
              <div className="detail-state">{detailMessage}</div>
            ) : (
              <AlertDetail
                alert={selectedAlert}
                reportLoading={reportLoading}
                onGenerateReport={generateReport}
              />
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Report</p>
                <h2>STR Preview</h2>
              </div>
            </div>
            <div className="report-output">{reportOutput}</div>
          </section>
        </aside>
      </main>
    </div>
  );
}
