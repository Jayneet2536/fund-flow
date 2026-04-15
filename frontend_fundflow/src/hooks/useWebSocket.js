import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { normalizeAlert } from '../api'

export function useWebSocket() {
  const [liveAlerts, setLiveAlerts] = useState([])
  const [connected, setConnected] = useState(false)
  const clientRef = useRef(null)

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),

      onConnect: () => {
        setConnected(true)
        console.log('[FundFlow WS] Connected to Spring Boot')

        client.subscribe('/topic/fraud-alerts', (message) => {
          try {
            const alert = normalizeAlert(JSON.parse(message.body))
            setLiveAlerts((prev) => [alert, ...prev].slice(0, 50))
          } catch (error) {
            console.error('[FundFlow WS] Parse error:', error)
          }
        })
      },

      onDisconnect: () => {
        setConnected(false)
        console.log('[FundFlow WS] Disconnected')
      },

      onStompError: (frame) => {
        console.error('[FundFlow WS] STOMP error:', frame)
        setConnected(false)
      },

      reconnectDelay: 5000,
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
    }
  }, [])

  const clearLiveAlerts = () => setLiveAlerts([])

  return { liveAlerts, connected, clearLiveAlerts }
}
