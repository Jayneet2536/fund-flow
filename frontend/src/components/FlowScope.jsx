import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

/*
  FlowScope — Interactive D3.js force-directed graph visualization
  Shows fund flow networks from fraud alert graph_data
*/

function formatAmount(amt) {
  if (!amt) return '₹0';
  if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`;
  if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
  return `₹${Math.round(amt).toLocaleString('en-IN')}`;
}

const NODE_COLORS = {
  high:   '#ff2d55',
  medium: '#ffab00',
  low:    '#00aaff',
  safe:   '#2ed573',
};

function getNodeColor(score) {
  if (score > 0.7) return NODE_COLORS.high;
  if (score > 0.5) return NODE_COLORS.medium;
  if (score > 0.3) return NODE_COLORS.low;
  return NODE_COLORS.safe;
}

function getEdgeColor(suspicion) {
  if (suspicion > 0.7) return '#ff2d55';
  if (suspicion > 0.5) return '#ffab00';
  return 'rgba(100,140,255,0.35)';
}

export default function FlowScope({ alert, alerts, onSelectAlert }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [currentAlert, setCurrentAlert] = useState(alert || alerts?.[0] || null);

  const graphData = currentAlert?.graph_data;

  const drawGraph = useCallback(() => {
    if (!svgRef.current || !graphData?.nodes?.length) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Defs for arrow markers and glow
    const defs = svg.append('defs');

    // Arrow marker
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'rgba(100,140,255,0.5)');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Main group for zoom
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Deep clone data
    const nodes = graphData.nodes.map(n => ({ ...n }));
    const edges = graphData.edges.map(e => ({ ...e }));

    // Validate edges reference existing nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    const validEdges = edges.filter(e =>
      nodeIds.has(e.source || e.from) && nodeIds.has(e.target || e.to)
    ).map(e => ({
      ...e,
      source: e.source || e.from,
      target: e.target || e.to,
    }));

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(validEdges).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    simulationRef.current = simulation;

    // Edge lines
    const linkGroup = g.append('g').attr('class', 'links');

    const link = linkGroup.selectAll('line')
      .data(validEdges)
      .join('line')
      .attr('stroke', d => getEdgeColor(d.suspicion || 0))
      .attr('stroke-width', d => {
        const amt = d.amount || 0;
        return Math.max(1.5, Math.min(6, Math.log10(amt / 100000 + 1) * 2));
      })
      .attr('stroke-opacity', 0.7)
      .attr('marker-end', 'url(#arrowhead)')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedEdge(d);
        setSelectedNode(null);
      });

    // Animated flow dots on edges
    const flowDots = linkGroup.selectAll('circle.flow-dot')
      .data(validEdges.filter(e => (e.suspicion || 0) > 0.3))
      .join('circle')
      .attr('class', 'flow-dot')
      .attr('r', 3)
      .attr('fill', d => getEdgeColor(d.suspicion || 0))
      .attr('opacity', 0.8);

    // Edge amount labels
    const edgeLabels = g.append('g').attr('class', 'edge-labels')
      .selectAll('text')
      .data(validEdges)
      .join('text')
      .text(d => formatAmount(d.amount))
      .attr('font-size', '9px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', 'rgba(136,150,184,0.7)')
      .attr('text-anchor', 'middle')
      .attr('dy', -8);

    // Node groups
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const node = nodeGroup.selectAll('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        setSelectedEdge(null);
      });

    // Node outer glow ring
    node.append('circle')
      .attr('r', 24)
      .attr('fill', 'none')
      .attr('stroke', d => getNodeColor(d.fraud_score || 0))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3)
      .attr('filter', 'url(#glow)');

    // Node circle
    node.append('circle')
      .attr('r', d => {
        const vol = (d.total_sent || 0) + (d.total_received || 0);
        return Math.max(14, Math.min(24, 8 + Math.log10(vol / 100000 + 1) * 5));
      })
      .attr('fill', d => {
        const color = getNodeColor(d.fraud_score || 0);
        return color.replace(')', ', 0.25)').replace('rgb', 'rgba').replace('#', '');
      })
      .attr('stroke', d => getNodeColor(d.fraud_score || 0))
      .attr('stroke-width', 2);

    // Properly color node fills using hex->rgba conversion
    node.selectAll('circle:nth-child(2)')
      .attr('fill', d => {
        const color = getNodeColor(d.fraud_score || 0);
        // Convert hex to rgba with opacity
        const r = parseInt(color.slice(1,3), 16);
        const g = parseInt(color.slice(3,5), 16);
        const b = parseInt(color.slice(5,7), 16);
        return `rgba(${r},${g},${b},0.2)`;
      });

    // Node label
    node.append('text')
      .text(d => (d.name || d.id || '').slice(0, 10))
      .attr('dy', 36)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 500)
      .attr('fill', '#8896b8');

    // Node ID label
    node.append('text')
      .text(d => d.id || '')
      .attr('dy', 48)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', '#556388');

    // New account indicator
    node.filter(d => d.is_new)
      .append('text')
      .text('★')
      .attr('dy', -26)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#ffab00');

    // Click background to deselect
    svg.on('click', () => {
      setSelectedNode(null);
      setSelectedEdge(null);
    });

    // Tick update
    let flowT = 0;
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      edgeLabels
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);

      // Animated flow dots
      flowT += 0.008;
      flowDots
        .attr('cx', d => d.source.x + (d.target.x - d.source.x) * ((flowT * (1 + (d.suspicion || 0))) % 1))
        .attr('cy', d => d.source.y + (d.target.y - d.source.y) * ((flowT * (1 + (d.suspicion || 0))) % 1));
    });

    // Initial zoom fit
    setTimeout(() => {
      const bounds = g.node().getBBox();
      if (bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          width / (bounds.width + 100),
          height / (bounds.height + 100),
          1.5
        );
        const transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(scale)
          .translate(-(bounds.x + bounds.width / 2), -(bounds.y + bounds.height / 2));
        svg.transition().duration(750).call(zoom.transform, transform);
      }
    }, 1000);

  }, [graphData]);

  useEffect(() => {
    drawGraph();
    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, [drawGraph]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => drawGraph();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawGraph]);

  return (
    <div>
      <div className="page-header">
        <h2>FlowScope</h2>
        <p>Interactive fund flow visualization — drag, zoom, and click nodes for details</p>
      </div>

      {/* Alert selector */}
      {alerts && alerts.length > 0 && (
        <div className="filter-bar">
          <select
            id="graph-alert-select"
            value={currentAlert?.id || ''}
            onChange={e => {
              const a = alerts.find(x => x.id === e.target.value);
              if (a) { setCurrentAlert(a); setSelectedNode(null); setSelectedEdge(null); }
            }}
            style={{ minWidth: 300 }}
          >
            {alerts.map(a => (
              <option key={a.id} value={a.id}>
                {a.typology} — {formatAmount(a.total_amount)} — {a.risk_level}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flowscope-container" ref={containerRef}>
        {!graphData?.nodes?.length ? (
          <div className="empty-state" style={{ paddingTop: '20vh' }}>
            <div className="icon">🕸️</div>
            <p>Select an alert to visualize its transaction network</p>
          </div>
        ) : (
          <>
            <svg ref={svgRef} className="flowscope-svg" />

            {/* Controls */}
            <div className="flowscope-controls">
              <button className="flowscope-btn" onClick={() => {
                if (svgRef.current) {
                  const svg = d3.select(svgRef.current);
                  svg.transition().duration(300).call(
                    d3.zoom().scaleExtent([0.2, 5]).on('zoom', () => {}).scaleBy, 1.3
                  );
                }
              }}>+</button>
              <button className="flowscope-btn" onClick={() => {
                if (svgRef.current) {
                  const svg = d3.select(svgRef.current);
                  svg.transition().duration(300).call(
                    d3.zoom().scaleExtent([0.2, 5]).on('zoom', () => {}).scaleBy, 0.7
                  );
                }
              }}>−</button>
              <button className="flowscope-btn" onClick={drawGraph} title="Reset view">⟲</button>
            </div>

            {/* Legend */}
            <div className="flowscope-legend">
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                Risk Level
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: NODE_COLORS.high }} /> High (&gt;0.7)
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: NODE_COLORS.medium }} /> Medium (0.5-0.7)
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: NODE_COLORS.low }} /> Low (0.3-0.5)
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: NODE_COLORS.safe }} /> Safe (&lt;0.3)
              </div>
              <div className="legend-item" style={{ marginTop: 4 }}>
                <span style={{ color: '#ffab00' }}>★</span> New Account
              </div>
            </div>

            {/* Node Info Panel */}
            {selectedNode && (
              <div className="flowscope-info-panel">
                <h4>🏦 Account Details</h4>
                <div className="info-row">
                  <span className="label">Account</span>
                  <span className="value">{selectedNode.id}</span>
                </div>
                <div className="info-row">
                  <span className="label">Name</span>
                  <span className="value">{selectedNode.name || 'Unknown'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Risk Score</span>
                  <span className="value" style={{
                    color: getNodeColor(selectedNode.fraud_score || 0)
                  }}>
                    {((selectedNode.fraud_score || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Total Sent</span>
                  <span className="value">{formatAmount(selectedNode.total_sent)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Total Received</span>
                  <span className="value">{formatAmount(selectedNode.total_received)}</span>
                </div>
                <div className="info-row">
                  <span className="label">New Account</span>
                  <span className="value">{selectedNode.is_new ? '✅ Yes' : 'No'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Dormancy</span>
                  <span className="value">{((selectedNode.dormancy || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            {/* Edge Info Panel */}
            {selectedEdge && (
              <div className="flowscope-info-panel">
                <h4>💸 Transaction Details</h4>
                <div className="info-row">
                  <span className="label">From</span>
                  <span className="value">{typeof selectedEdge.source === 'object' ? selectedEdge.source.id : selectedEdge.source}</span>
                </div>
                <div className="info-row">
                  <span className="label">To</span>
                  <span className="value">{typeof selectedEdge.target === 'object' ? selectedEdge.target.id : selectedEdge.target}</span>
                </div>
                <div className="info-row">
                  <span className="label">Amount</span>
                  <span className="value">{formatAmount(selectedEdge.amount)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Payment</span>
                  <span className="value">{selectedEdge.payment_format || '—'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Time</span>
                  <span className="value">{selectedEdge.timestamp || '—'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Suspicion</span>
                  <span className="value" style={{
                    color: getEdgeColor(selectedEdge.suspicion || 0)
                  }}>
                    {((selectedEdge.suspicion || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                {selectedEdge.is_trigger && (
                  <div style={{
                    marginTop: 8, padding: '4px 10px', borderRadius: 4,
                    background: 'rgba(255,45,85,0.1)', color: '#ff2d55',
                    fontSize: '0.72rem', fontWeight: 600, textAlign: 'center',
                  }}>
                    ⚡ TRIGGER TRANSACTION
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
