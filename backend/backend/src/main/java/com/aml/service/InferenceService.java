package com.aml.service;

import com.aml.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class InferenceService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${inference.url}")
    private String inferenceUrl;   // http://localhost:8000

    public InferenceService(RestTemplate restTemplate,
                            ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    // ── SCORE TRANSACTION ─────────────────────────────────────────
    public ScoreResponse score(ScoreRequest request) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<ScoreRequest> entity = new HttpEntity<>(request, headers);

            ResponseEntity<ScoreResponse> response = restTemplate.exchange(
                    inferenceUrl + "/score",
                    HttpMethod.POST,
                    entity,
                    ScoreResponse.class
            );

            return response.getBody();

        } catch (Exception e) {
            System.err.println("Inference service error: " + e.getMessage());
            // Return safe default — don't crash the whole pipeline
            ScoreResponse fallback = new ScoreResponse();
            fallback.setIsFraud(false);
            fallback.setTypology("Legitimate");
            fallback.setRiskLevel("LOW");
            fallback.setFraudScore(0.0);
            return fallback;
        }
    }

    // ── GENERATE REPORT ───────────────────────────────────────────
    public Map<String, Object> generateReport(
            ScoreResponse scoreResult,
            List<AccountNode> nodes,
            List<EdgeData> edges) {

        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("score_result",      scoreResult);
            requestBody.put("nodes",             nodes);
            requestBody.put("edges",             edges);
            requestBody.put("reporting_entity",  "Demo Bank Ltd");
            requestBody.put("branch",            "Main Branch");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity =
                    new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    inferenceUrl + "/report",
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            return response.getBody();

        } catch (Exception e) {
            System.err.println("Report generation error: " + e.getMessage());
            return Map.of("error", "Report generation failed: " + e.getMessage());
        }
    }
}