package com.aml.controller;

import com.aml.model.FraudAlert;
import com.aml.service.InferenceService;
import com.aml.service.TransactionService;
import com.aml.repository.Neo4jRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@RestController
@RequestMapping("/api")
public class AlertController {

    // 1. Group all class fields together at the top
    private final TransactionService transactionService;
    private final InferenceService inferenceService;
    private final Neo4jRepository neo4j;
    private final RestTemplate restTemplate;

    @Value("${inference.url}")
    private String inferenceUrl;

    // 2. Keep ONLY ONE constructor so Spring knows how to autowire
    public AlertController(
            TransactionService transactionService,
            InferenceService inferenceService,
            Neo4jRepository neo4j,
            RestTemplate restTemplate) {
        this.transactionService = transactionService;
        this.inferenceService   = inferenceService;
        this.neo4j              = neo4j;
        this.restTemplate       = restTemplate;
    }

    // Frontend polls this for recent fraud alerts
    @GetMapping("/alerts")
    public ResponseEntity<List<FraudAlert>> getAlerts(
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(
                transactionService.getRecentAlerts()
        );
    }

    // Frontend requests report generation
    @PostMapping("/alerts/{transactionId}/report")
    public ResponseEntity<Map<String, Object>> generateReport(
            @PathVariable String transactionId,
            @RequestBody Map<String, Object> body) {
        try {
            // Forward the entire body to inference service
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    inferenceUrl + "/report",
                    HttpMethod.POST,
                    entity,
                    Map.class
            );
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }
}