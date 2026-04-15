import React, { useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

const NODE_COLORS = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  'LOW-MEDIUM': '#facc15',
  LOW: '#10b981',
  SAFE: '#10b981',
  UNKNOWN: '#3b82f6',
}

function getSuspicionColor(suspicion = 0) {
  if (suspicion >= 0.8) return 'rgba(239,68,68,0.9)'
  if (suspicion >= 0.55) return 'rgba(245,158,11,0.85)'
  return 'rgba(59,130,246,0.45)'
}

export default function GraphView({ graphData, loading, error }) {
  const fgRef = useRef()
  const [hoveredNode, setHoveredNode] = useState(null)
  const [hoveredLink, setHoveredLink] = useState(null)

  const forceGraphData = useMemo(() => {
    if (!graphData) return getEmptyGraph()

    return {
      nodes: graphData.nodes ?? [],
      links: (graphData.edges ?? []).map((edge) => ({
        ...edge,
        source: edge.source,
        target: edge.target,
      })),
    }
  }, [graphData])

  const nodeCanvasObject = (node, ctx, globalScale) => {
    const r = node.riskLevel === 'HIGH' ? 7 : 5
    const color = NODE_COLORS[node.riskLevel] || NODE_COLORS.UNKNOWN

    if (node.riskLevel === 'HIGH') {
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(239,68,68,0.15)'
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()

    const label = node.label || node.name || node.id
    const fontSize = Math.max(8, 10 / globalScale)
    ctx.font = `${fontSize}px IBM Plex Mono`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.textAlign = 'center'
    ctx.fillText(label, node.x, node.y + r + fontSize + 1)
  }

  const linkCanvasObject = (link, ctx) => {
    const suspicion = Number(link.suspicion ?? 0)
    const linkColor = link.isTrigger ? 'rgba(239,68,68,0.88)' : getSuspicionColor(suspicion)
    const lineWidth = link.isTrigger ? 2.8 : 1 + suspicion * 2.2

    ctx.beginPath()
    ctx.moveTo(link.source.x, link.source.y)
    ctx.lineTo(link.target.x, link.target.y)
    ctx.strokeStyle = linkColor
    ctx.lineWidth = lineWidth
    ctx.stroke()

    const dx = link.target.x - link.source.x
    const dy = link.target.y - link.source.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return

    const ux = dx / len
    const uy = dy / len
    const ax = link.target.x - ux * 8
    const ay = link.target.y - uy * 8

    ctx.beginPath()
    ctx.moveTo(ax - uy * 3, ay + ux * 3)
    ctx.lineTo(ax + uy * 3, ay - ux * 3)
    ctx.lineTo(link.target.x, link.target.y)
    ctx.fillStyle = linkColor
    ctx.fill()
  }

  const hasGraph = forceGraphData.nodes.length > 0

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0c10', borderRadius: '10px', overflow: 'hidden' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: '13px', zIndex: 10 }}>
          Loading graph from backend...
        </div>
      )}

      {!loading && error && (
        <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: '11px', padding: '4px 12px', borderRadius: '6px', zIndex: 10, whiteSpace: 'nowrap' }}>
          {error}
        </div>
      )}

      {!loading && !hasGraph && !error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: '13px', zIndex: 10 }}>
          Select an alert to inspect its transaction graph
        </div>
      )}

      <ForceGraph2D
        ref={fgRef}
        graphData={hasGraph ? forceGraphData : getEmptyGraph()}
        backgroundColor="#0a0c10"
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalParticles={(link) => (hasGraph ? Math.max(1, Math.round((link.suspicion ?? 0) * 4)) : 0)}
        linkDirectionalParticleWidth={(link) => 1 + Number(link.suspicion ?? 0) * 1.6}
        linkDirectionalParticleColor={(link) => (link.isTrigger ? 'rgba(239,68,68,0.9)' : getSuspicionColor(Number(link.suspicion ?? 0)))}
        nodeRelSize={5}
        cooldownTicks={100}
        onNodeHover={(node) => setHoveredNode(node || null)}
        onLinkHover={(link) => setHoveredLink(link || null)}
        onEngineStop={() => {
          if (hasGraph) fgRef.current?.zoomToFit(400, 30)
        }}
      />

      {(hoveredNode || hoveredLink) && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '220px',
          background: 'rgba(12,14,18,0.92)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '10px 12px',
          zIndex: 12,
        }}>
          {hoveredNode && (
            <>
              <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Node</div>
              <div style={{ fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--mono)', marginTop: '4px' }}>{hoveredNode.id}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px' }}>Risk {hoveredNode.riskLevel || 'UNKNOWN'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Fraud score {Number(hoveredNode.fraudScore ?? 0).toFixed(3)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Total sent INR {Number(hoveredNode.totalSent ?? 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Total received INR {Number(hoveredNode.totalReceived ?? 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>
                {hoveredNode.isNew ? 'New account' : `Dormancy ${Number(hoveredNode.dormancy ?? 0).toFixed(2)}`}
              </div>
            </>
          )}
          {hoveredLink && (
            <>
              <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: hoveredNode ? '10px' : 0 }}>Edge</div>
              <div style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--mono)', marginTop: '4px' }}>
                {hoveredLink.source.id || hoveredLink.source} to {hoveredLink.target.id || hoveredLink.target}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px' }}>
                {hoveredLink.currency || 'INR'} {Number(hoveredLink.amount ?? 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Suspicion {Number(hoveredLink.suspicion ?? 0).toFixed(3)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>{hoveredLink.paymentFormat || 'NEFT'}</div>
            </>
          )}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '12px', left: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[['Node risk', '#ef4444'], ['Edge suspicion', '#f59e0b'], ['Trigger edge', '#ef4444']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ width: label === 'Edge suspicion' ? '12px' : '8px', height: '8px', borderRadius: label === 'Edge suspicion' ? '2px' : '50%', background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

function getEmptyGraph() {
  return { nodes: [], links: [] }
}
