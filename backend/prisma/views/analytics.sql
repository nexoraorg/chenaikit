-- Analytics Views for ChenAIKit

-- API Usage Summary by Endpoint and Status
CREATE VIEW IF NOT EXISTS api_usage_summary AS
SELECT 
    endpoint,
    method,
    statusCode,
    COUNT(*) as total_requests,
    AVG(responseTime) as avg_response_time,
    SUM(requestSize) as total_request_size,
    SUM(responseSize) as total_response_size,
    DATE(timestamp) as usage_date
FROM api_usage
GROUP BY endpoint, method, statusCode, DATE(timestamp);

-- Hourly Traffic Trends
CREATE VIEW IF NOT EXISTS hourly_traffic_trends AS
SELECT 
    strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
    COUNT(*) as request_count,
    COUNT(DISTINCT apiKeyId) as active_keys,
    AVG(responseTime) as avg_latency
FROM api_usage
GROUP BY hour;

-- AI Model Performance Distribution
CREATE VIEW IF NOT EXISTS ai_performance_distribution AS
SELECT 
    CASE 
        WHEN score >= 800 THEN 'Excellent'
        WHEN score >= 700 THEN 'Good'
        WHEN score >= 600 THEN 'Fair'
        ELSE 'Poor'
    END as score_tier,
    COUNT(*) as count,
    DATE(createdAt) as analysis_date
FROM credit_score
GROUP BY score_tier, analysis_date;

-- Fraud Alert Summary
CREATE VIEW IF NOT EXISTS fraud_alert_summary AS
SELECT 
    alertType,
    resolved,
    COUNT(*) as count,
    DATE(createdAt) as alert_date
FROM fraud_alert
GROUP BY alertType, resolved, alert_date;

-- Blockchain Transaction Volume
CREATE VIEW IF NOT EXISTS blockchain_volume AS
SELECT 
    assetType,
    SUM(amount) as total_volume,
    COUNT(*) as transaction_count,
    DATE(timestamp) as tx_date
FROM "transaction"
GROUP BY assetType, tx_date;
