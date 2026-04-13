package com.aml.service;

import com.aml.model.*;
import com.aml.repository.Neo4jRepository;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.*;

@Service
public class TransactionService {

    private final Neo4jRepository neo4j;
    private final InferenceService inferenceService;
    private final SimpMessagingTemplate messagingTemplate;  // WebSocket

    // In-memory store of recent fraud alerts for polling fallback
    private final List<FraudAlert> recentAlerts = Collections.synchronizedList(
            new ArrayList<>()
    );

    public TransactionService(
            Neo4jRepository neo4j,
            InferenceService inferenceService,
            SimpMessagingTemplate messagingTemplate) {
        this.neo4j             = neo4j;
        this.inferenceService  = inferenceService;
        this.messagingTemplate = messagingTemplate;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> processTransaction(Transaction tx) {
        // Step 1: Store in Neo4j + update node properties
        neo4j.storeTransaction(tx);
        System.out.println("Stored: " + tx.getFromAccount()
                + " → " + tx.getToAccount()
                + " ₹" + tx.getAmount());

        // Step 2: Get 2-hop neighborhood from Neo4j
        Map<String, Object> neighborhood = neo4j.getNeighborhood(
                tx.getFromAccount(),
                tx.getToAccount(),
                tx.getTimestamp()
        );

        List<AccountNode> nodes = (List<AccountNode>)
                neighborhood.getOrDefault("nodes", new ArrayList<>());
        List<EdgeData> edges = (List<EdgeData>)
                neighborhood.getOrDefault("edges", new ArrayList<>());
        System.out.println("DEBUG neighborhood query returned:");
        System.out.println("  Nodes count : " + nodes.size());
        System.out.println("  Edges count : " + edges.size());
        for (EdgeData e : edges) {
            System.out.println("  Edge: " + e.getFromAccount()
                    + " → " + e.getToAccount()
                    + " ₹" + e.getAmount()
                    + " id=" + e.getEdgeId());
        }
        // If no related transactions found, just send the trigger itself
        if (edges.isEmpty()) {
            EdgeData triggerEdge = EdgeData.builder()
                    .edgeId(tx.getTransactionId())
                    .fromAccount(tx.getFromAccount())
                    .toAccount(tx.getToAccount())
                    .amount(tx.getAmount())
                    .currency(tx.getCurrency() != null ? tx.getCurrency() : "INR")
                    .paymentFormat(tx.getPaymentFormat() != null
                            ? tx.getPaymentFormat() : "NEFT")
                    .timestamp(tx.getTimestamp())
                    .isTrigger(true)
                    .build();
            edges.add(triggerEdge);

            // Minimal node data from what we know
            AccountNode fromNode = AccountNode.builder()
                    .accountId(tx.getFromAccount())
                    .name(tx.getFromName() != null ? tx.getFromName() : "Unknown")
                    .totalSent(tx.getAmount())
                    .totalReceived(0.0)
                    .txCountOut(1).txCountIn(0)
                    .uniqueCounterparts(1)
                    .isNewAccount(true)
                    .dormancyScore(0.0)
                    .build();

            AccountNode toNode = AccountNode.builder()
                    .accountId(tx.getToAccount())
                    .name(tx.getToName() != null ? tx.getToName() : "Unknown")
                    .totalSent(0.0)
                    .totalReceived(tx.getAmount())
                    .txCountOut(0).txCountIn(1)
                    .uniqueCounterparts(1)
                    .isNewAccount(true)
                    .dormancyScore(0.0)
                    .build();

            nodes.add(fromNode);
            nodes.add(toNode);
        } else {
            // Mark the trigger edge
            for (EdgeData e : edges) {
                if (e.getEdgeId().equals(tx.getTransactionId())) {
                    e.setIsTrigger(true);
                }
            }
        }

        // Step 3: Call Python inference service
        ScoreRequest scoreRequest = ScoreRequest.builder()
                .triggerTransactionId(tx.getTransactionId())
                .nodes(nodes)
                .edges(edges)
                .build();

        ScoreResponse scoreResult = inferenceService.score(scoreRequest);
        System.out.println("Score: " + scoreResult.getTypology()
                + " | " + scoreResult.getRiskLevel()
                + " | " + scoreResult.getFraudScore());

        // Step 4: Update Neo4j with result
        neo4j.updateFraudResult(
                tx.getTransactionId(),
                scoreResult.getIsFraud(),
                scoreResult.getTypology(),
                scoreResult.getRiskLevel(),
                scoreResult.getFraudScore() != null ? scoreResult.getFraudScore() : 0.0
        );

        // Step 5: If fraud → create alert + push to frontend via WebSocket
        if (Boolean.TRUE.equals(scoreResult.getIsFraud())) {
            double totalAmount = edges.stream()
                    .mapToDouble(EdgeData::getAmount).sum();

            List<String> accountIds = new ArrayList<>();
            nodes.forEach(n -> accountIds.add(n.getAccountId()));

            FraudAlert alert = FraudAlert.builder()
                    .id(tx.getTransactionId())
                    .timestamp(tx.getTimestamp())
                    .typology(scoreResult.getTypology())
                    .riskLevel(scoreResult.getRiskLevel())
                    .fraudScore(scoreResult.getFraudScore())
                    .triggerTransactionId(tx.getTransactionId())
                    .graphData(scoreResult.getGraphData())
                    .evidenceChain(scoreResult.getEvidenceChain())
                    .riskBreakdown(scoreResult.getRiskBreakdown())
                    .totalAmount(totalAmount)
                    .accountsInvolved(accountIds)
                    .build();

            recentAlerts.add(0, alert);  // newest first
            if (recentAlerts.size() > 100) {
                recentAlerts.remove(recentAlerts.size() - 1);
            }

            // Push via WebSocket to React frontend
            messagingTemplate.convertAndSend("/topic/fraud-alerts", alert);
            System.out.println("🚨 FRAUD ALERT sent: " + scoreResult.getTypology());
        }

        return Map.of(
                "transaction_id", tx.getTransactionId(),
                "status",         "processed",
                "is_fraud",       scoreResult.getIsFraud(),
                "typology",       scoreResult.getTypology(),
                "risk_level",     scoreResult.getRiskLevel()
        );
    }

    public List<FraudAlert> getRecentAlerts() {
        return new ArrayList<>(recentAlerts);
    }
}