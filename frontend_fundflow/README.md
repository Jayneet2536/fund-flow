# FundFlow Frontend — Setup Guide

## Project Structure
```
fundflow-frontend/
├── src/
│   ├── api/index.js          ← All API calls (Spring Boot)
│   ├── hooks/useWebSocket.js ← Real-time alerts (STOMP/SockJS)
│   ├── components/
│   │   ├── Dashboard.jsx     ← Main page
│   │   ├── FraudAlertCard.jsx
│   │   ├── FraudDetailModal.jsx
│   │   └── GraphView.jsx     ← Neo4j graph (react-force-graph-2d)
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── CorsConfig.java           ← Copy to your Spring Boot project
├── WebSocketConfig.java      ← Copy to your Spring Boot project
├── vite.config.js            ← Proxy: /api → localhost:8080
└── package.json
```

---

## Step 1 — Install dependencies

```bash
cd fundflow-frontend
npm install
```

---

## Step 2 — Add Java files to Spring Boot

Copy these 2 files into your Spring Boot project:
- `CorsConfig.java`     → `src/main/java/com/yourpackage/config/`
- `WebSocketConfig.java`→ `src/main/java/com/yourpackage/config/`

Change `com.yourpackage` to your actual package name.

Add to `pom.xml` if not already there:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

---

## Step 3 — Spring Boot API endpoints needed

React expects these REST endpoints from Spring Boot:

| Method | URL                        | Returns                        |
|--------|----------------------------|--------------------------------|
| GET    | /alerts                    | List of fraud alerts           |
| GET    | /alerts/{id}               | Single alert                   |
| PUT    | /alerts/{id}/status        | Update alert status            |
| GET    | /transactions              | List of transactions           |
| POST   | /transactions              | Submit new transaction         |
| GET    | /graph/subgraph/{accountId}| { nodes:[], links:[] }         |
| GET    | /graph/full                | Full graph                     |
| GET    | /risk/score/{txnId}        | Risk score result              |
| POST   | /reports/generate/{alertId}| Generate STR via Gemini        |
| GET    | /reports/{alertId}         | Get generated report           |
| GET    | /dashboard/stats           | { totalTransactions, totalAlerts, highRisk, avgFraudScore } |

Alert JSON format expected:
```json
{
  "id": 1,
  "transactionId": "TXN-0091",
  "typology": "Round-Trip",
  "riskLevel": "HIGH",
  "fraudScore": 0.92,
  "senderAccount": "ACC-112",
  "receiverAccount": "ACC-449",
  "amount": 240000,
  "paymentType": "NEFT",
  "timestamp": "02:14 AM",
  "status": "PENDING",
  "graphHops": 3,
  "accountAge": "14 days",
  "evidenceChain": ["ACC-112 → ACC-220", "ACC-220 → ACC-449 (LOOP)"]
}
```

---

## Step 4 — Run everything (ORDER MATTERS)

### Terminal 1 — Neo4j
```
Start Neo4j Desktop → localhost:7687
```

### Terminal 2 — Python FastAPI
```bash
cd your-python-folder
python inference_service.py
# Runs on localhost:8000
```

### Terminal 3 — Spring Boot
```bash
cd backend
mvn spring-boot:run
# Runs on localhost:8080
```

### Terminal 4 — React Frontend
```bash
cd fundflow-frontend
npm run dev
# Runs on localhost:5173
```

Open: http://localhost:5173

---

## How connections work

```
React (5173)
    ↓  HTTP /api/*  (Vite proxies to 8080)
Spring Boot (8080)
    ↓  REST call
FastAPI Python (8000)
    ↓  Cypher queries
Neo4j (7687)

React (5173)
    ↕  WebSocket ws://localhost:8080/ws
Spring Boot (8080)  ← pushes real-time alerts
```

---

## Frontend works without backend too!
If Spring Boot is not running, the UI shows **demo data** automatically.
You'll see a red "Demo mode" badge in the top bar.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS error in browser | Add CorsConfig.java to Spring Boot |
| Graph not loading | Check Neo4j is running on 7687 |
| WebSocket disconnected | Add WebSocketConfig.java + spring-boot-starter-websocket |
| API 404 errors | Check Spring Boot controller URLs match the table above |
| npm install fails | Use Node.js v18+ |
