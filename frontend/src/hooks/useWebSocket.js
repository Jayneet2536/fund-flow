import { useState, useEffect, useRef, useCallback } from 'react';

/*
  WebSocket hook — STOMP over native WebSocket.
  Only connects when backend is reachable.
  Uses long exponential backoff to avoid spamming.
*/

function buildStompFrame(command, headers = {}, body = '') {
  let frame = command + '\n';
  for (const [k, v] of Object.entries(headers)) frame += `${k}:${v}\n`;
  return frame + '\n' + body + '\0';
}

function parseStompFrame(data) {
  const lines = data.split('\n');
  const command = lines[0];
  const headers = {};
  let i = 1;
  while (i < lines.length && lines[i] !== '') {
    const idx = lines[i].indexOf(':');
    if (idx > 0) headers[lines[i].slice(0, idx)] = lines[i].slice(idx + 1);
    i++;
  }
  const body = lines.slice(i + 1).join('\n').replace(/\0$/, '');
  return { command, headers, body };
}

export function useWebSocket(onAlert) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const backoffRef = useRef(5000); // start at 5s, grows to 60s max

  const cleanup = () => {
    clearTimeout(timerRef.current);
    clearInterval(heartbeatRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const scheduleRetry = useCallback(() => {
    const delay = backoffRef.current;
    backoffRef.current = Math.min(60000, backoffRef.current * 1.5); // max 60s
    timerRef.current = setTimeout(tryConnect, delay);
  }, []);

  const tryConnect = useCallback(() => {
    // Don't open WebSocket — the proxy error spam comes from failed WS upgrades.
    // Instead, check via a plain fetch first (silent, errors suppressed in api.js).
    fetch('/api/alerts?limit=1')
      .then(res => {
        if (!res.ok) throw new Error();
        backoffRef.current = 5000; // reset backoff on success
        openSocket();
      })
      .catch(() => {
        // Backend still offline — retry with backoff, no console noise
        scheduleRetry();
      });
  }, [scheduleRetry]);

  const openSocket = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/websocket`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(buildStompFrame('CONNECT', {
          'accept-version': '1.1,1.2',
          'heart-beat': '20000,20000',
        }));
      };

      ws.onmessage = (evt) => {
        const frame = parseStompFrame(evt.data);
        if (frame.command === 'CONNECTED') {
          setConnected(true);
          ws.send(buildStompFrame('SUBSCRIBE', { id: 'sub-0', destination: '/topic/fraud-alerts' }));
          heartbeatRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send('\n');
          }, 20000);
        }
        if (frame.command === 'MESSAGE' && frame.body) {
          try { onAlert?.(JSON.parse(frame.body)); } catch {}
        }
      };

      ws.onclose = () => {
        setConnected(false);
        clearInterval(heartbeatRef.current);
        scheduleRetry();
      };

      ws.onerror = () => {
        setConnected(false);
        ws.close();
      };
    } catch {
      scheduleRetry();
    }
  }, [onAlert, scheduleRetry]);

  useEffect(() => {
    // Delay initial connection attempt by 2s so page loads first
    timerRef.current = setTimeout(tryConnect, 2000);
    return cleanup;
  }, [tryConnect]);

  return { connected };
}
