-- Database Performance Testing Suite
-- Comprehensive query performance analysis and optimization

-- Create performance testing schema
CREATE SCHEMA IF NOT EXISTS performance_tests;
SET search_path TO performance_tests, public;

-- Performance monitoring tables
CREATE TABLE IF NOT EXISTS query_performance_log (
    id SERIAL PRIMARY KEY,
    query_name VARCHAR(255) NOT NULL,
    execution_time_ms FLOAT NOT NULL,
    rows_affected INTEGER,
    index_usage TEXT,
    execution_plan TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    test_run_id UUID DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS index_performance_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    index_name VARCHAR(255) NOT NULL,
    index_size_mb FLOAT NOT NULL,
    usage_count INTEGER NOT NULL,
    last_used TIMESTAMP,
    efficiency_score FLOAT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance testing functions
CREATE OR REPLACE FUNCTION log_query_performance(
    query_name TEXT,
    execution_time FLOAT,
    rows_affected INTEGER DEFAULT NULL,
    index_usage TEXT DEFAULT NULL,
    execution_plan TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO query_performance_log (query_name, execution_time_ms, rows_affected, index_usage, execution_plan)
    VALUES (query_name, execution_time, rows_affected, index_usage, execution_plan);
END;
$$ LANGUAGE plpgsql;

-- Enable query logging
-- Note: This requires superuser privileges
-- ALTER SYSTEM SET log_min_duration_statement = 0;
-- SELECT pg_reload_conf();

-- Test 1: Basic SELECT query performance
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time FLOAT;
    plan TEXT;
BEGIN
    -- Test basic transaction query
    start_time := clock_timestamp();
    
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT t.*, u.email 
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.created_at >= NOW() - INTERVAL '7 days'
    AND t.status = 'completed'
    ORDER BY t.created_at DESC
    LIMIT 100;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    GET DIAGNOSTICS plan = MESSAGE_TEXT;
    
    PERFORM log_query_performance('basic_transaction_query', execution_time, NULL, NULL, plan);
    
    RAISE NOTICE 'Basic query executed in % ms', execution_time;
END $$;

-- Test 2: Complex JOIN query performance
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time FLOAT;
    plan TEXT;
BEGIN
    start_time := clock_timestamp();
    
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT 
        t.id,
        t.amount,
        t.currency,
        t.status,
        u.email,
        a.type as alert_type,
        a.severity,
        cs.score as credit_score,
        fd.risk_score as fraud_risk
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN alerts a ON t.id = a.transaction_id
    LEFT JOIN credit_scores cs ON u.id = cs.user_id
    LEFT JOIN fraud_detection fd ON t.id = fd.transaction_id
    WHERE t.created_at >= NOW() - INTERVAL '30 days'
    AND t.amount > 1000
    ORDER BY t.created_at DESC
    LIMIT 50;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    GET DIAGNOSTICS plan = MESSAGE_TEXT;
    
    PERFORM log_query_performance('complex_join_query', execution_time, NULL, NULL, plan);
    
    RAISE NOTICE 'Complex JOIN query executed in % ms', execution_time;
END $$;

-- Test 3: Aggregate query performance
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time FLOAT;
    plan TEXT;
BEGIN
    start_time := clock_timestamp();
    
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MAX(amount) as max_amount,
        MIN(amount) as min_amount,
        COUNT(DISTINCT user_id) as unique_users
    FROM transactions
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date DESC;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    GET DIAGNOSTICS plan = MESSAGE_TEXT;
    
    PERFORM log_query_performance('aggregate_query', execution_time, NULL, NULL, plan);
    
    RAISE NOTICE 'Aggregate query executed in % ms', execution_time;
END $$;

-- Test 4: INSERT performance
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time FLOAT;
    plan TEXT;
    batch_size INTEGER := 1000;
    i INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Batch insert test
    INSERT INTO transactions (user_id, amount, currency, status, recipient_address, created_at)
    SELECT 
        (random() * 1000)::INTEGER + 1,
        (random() * 10000)::NUMERIC(10,2),
        'USD',
        CASE WHEN random() > 0.1 THEN 'completed' ELSE 'pending' END,
        'G' || upper(encode(decode(md5(random()::text), 'hex'), 'base64')),
        NOW() - (random() * INTERVAL '30 days')
    FROM generate_series(1, batch_size) s(i);
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    PERFORM log_query_performance('batch_insert', execution_time, batch_size, NULL, NULL);
    
    RAISE NOTICE 'Batch insert (% records) executed in % ms', batch_size, execution_time;
END $$;

-- Test 5: UPDATE performance
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time FLOAT;
    plan TEXT;
    rows_updated INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    UPDATE transactions 
    SET status = 'completed', 
        updated_at = NOW()
    WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    PERFORM log_query_performance('batch_update', execution_time, rows_updated, NULL, NULL);
    
    RAISE NOTICE 'Batch update (% records) executed in % ms', rows_updated, execution_time;
END $$;

-- Test 6: DELETE performance
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time FLOAT;
    plan TEXT;
    rows_deleted INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    DELETE FROM alerts 
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND status = 'resolved';
    
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    PERFORM log_query_performance('batch_delete', execution_time, rows_deleted, NULL, NULL);
    
    RAISE NOTICE 'Batch delete (% records) executed in % ms', rows_deleted, execution_time;
END $$;

-- Index usage analysis
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE(
    table_name TEXT,
    index_name TEXT,
    index_size_mb FLOAT,
    usage_count BIGINT,
    last_used TIMESTAMP,
    efficiency_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename as table_name,
        indexname as index_name,
        pg_relation_size(indexrelid) / 1024.0 / 1024.0 as index_size_mb,
        idx_scan as usage_count,
        idx_tup_read as last_read,
        CASE 
            WHEN idx_scan = 0 THEN 0
            ELSE (idx_tup_read::FLOAT / idx_scan) / (pg_relation_size(indexrelid) / 1024.0 / 1024.0)
        END as efficiency_score
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY efficiency_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Query performance analysis
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE(
    query_name TEXT,
    avg_execution_time FLOAT,
    min_execution_time FLOAT,
    max_execution_time FLOAT,
    total_executions BIGINT,
    performance_trend TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        query_name,
        AVG(execution_time_ms) as avg_execution_time,
        MIN(execution_time_ms) as min_execution_time,
        MAX(execution_time_ms) as max_execution_time,
        COUNT(*) as total_executions,
        CASE 
            WHEN AVG(execution_time_ms) < 100 THEN 'Excellent'
            WHEN AVG(execution_time_ms) < 500 THEN 'Good'
            WHEN AVG(execution_time_ms) < 1000 THEN 'Fair'
            ELSE 'Poor'
        END as performance_trend
    FROM query_performance_log
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY query_name
    ORDER BY avg_execution_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Database size analysis
CREATE OR REPLACE FUNCTION analyze_database_size()
RETURNS TABLE(
    table_name TEXT,
    table_size_mb FLOAT,
    index_size_mb FLOAT,
    total_size_mb FLOAT,
    row_count BIGINT,
    bloat_percentage FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename as table_name,
        pg_total_relation_size(schemaname || '.' || tablename) / 1024.0 / 1024.0 as table_size_mb,
        pg_indexes_size(schemaname || '.' || tablename) / 1024.0 / 1024.0 as index_size_mb,
        (pg_total_relation_size(schemaname || '.' || tablename) + pg_indexes_size(schemaname || '.' || tablename)) / 1024.0 / 1024.0 as total_size_mb,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        CASE 
            WHEN (n_tup_upd + n_tup_del) = 0 THEN 0
            ELSE (n_tup_upd + n_tup_del)::FLOAT / (n_tup_ins + n_tup_upd + n_tup_del) * 100
        END as bloat_percentage
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY total_size_mb DESC;
END;
$$ LANGUAGE plpgsql;

-- Performance recommendations
CREATE OR REPLACE FUNCTION generate_performance_recommendations()
RETURNS TABLE(
    recommendation_type TEXT,
    priority TEXT,
    description TEXT,
    sql_command TEXT
) AS $$
BEGIN
    -- Slow queries
    RETURN QUERY
    SELECT 
        'Query Optimization'::TEXT,
        CASE WHEN avg_time > 1000 THEN 'High' WHEN avg_time > 500 THEN 'Medium' ELSE 'Low' END::TEXT,
        'Query "' || query_name || '" has average execution time of ' || ROUND(avg_time, 2) || 'ms'::TEXT,
        'Consider adding indexes or rewriting the query'::TEXT
    FROM (
        SELECT query_name, AVG(execution_time_ms) as avg_time
        FROM query_performance_log
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY query_name
        HAVING AVG(execution_time_ms) > 500
    ) slow_queries;
    
    -- Unused indexes
    RETURN QUERY
    SELECT 
        'Index Optimization'::TEXT,
        'Medium'::TEXT,
        'Index "' || index_name || '" on table "' || table_name || '" has not been used recently'::TEXT,
        'DROP INDEX ' || index_name || ';'::TEXT
    FROM analyze_index_usage()
    WHERE usage_count = 0 AND index_size_mb > 10;
    
    -- Large tables
    RETURN QUERY
    SELECT 
        'Table Optimization'::TEXT,
        CASE WHEN total_size_mb > 1000 THEN 'High' WHEN total_size_mb > 100 THEN 'Medium' ELSE 'Low' END::TEXT,
        'Table "' || table_name || '" is ' || ROUND(total_size_mb, 2) || 'MB with ' || row_count || ' rows'::TEXT,
        'Consider partitioning or archiving old data'::TEXT
    FROM analyze_database_size()
    WHERE total_size_mb > 100;
END;
$$ LANGUAGE plpgsql;

-- Run comprehensive performance analysis
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== Database Performance Analysis ===';
    
    -- Index usage analysis
    RAISE NOTICE 'Index Usage Analysis:';
    FOR rec IN SELECT * FROM analyze_index_usage() LIMIT 10 LOOP
        RAISE NOTICE '  %: % (%.2f MB, % uses, efficiency: %.2f)', 
            rec.table_name, rec.index_name, rec.index_size_mb, rec.usage_count, rec.efficiency_score;
    END LOOP;
    
    -- Query performance analysis
    RAISE NOTICE '% Query Performance Analysis:', chr(10);
    FOR rec IN SELECT * FROM analyze_query_performance() LIMIT 10 LOOP
        RAISE NOTICE '  %: %.2fms avg (% executions, trend: %)', 
            rec.query_name, rec.avg_execution_time, rec.total_executions, rec.performance_trend;
    END LOOP;
    
    -- Database size analysis
    RAISE NOTICE '% Database Size Analysis:', chr(10);
    FOR rec IN SELECT * FROM analyze_database_size() LIMIT 10 LOOP
        RAISE NOTICE '  %: %.2f MB total (%.2f MB data, %.2f MB indexes, % rows)', 
            rec.table_name, rec.total_size_mb, rec.table_size_mb, rec.index_size_mb, rec.row_count;
    END LOOP;
    
    -- Performance recommendations
    RAISE NOTICE '% Performance Recommendations:', chr(10);
    FOR rec IN SELECT * FROM generate_performance_recommendations() ORDER BY priority DESC LIMIT 10 LOOP
        RAISE NOTICE '  [%] %: %', rec.priority, rec.recommendation_type, rec.description;
        IF rec.sql_command IS NOT NULL THEN
            RAISE NOTICE '    SQL: %', rec.sql_command;
        END IF;
    END LOOP;
END $$;

-- Performance test runner function
CREATE OR REPLACE FUNCTION run_performance_tests()
RETURNS TABLE(
    test_name TEXT,
    execution_time_ms FLOAT,
    status TEXT,
    recommendations TEXT[]
) AS $$
DECLARE
    test_start TIMESTAMP;
    test_end TIMESTAMP;
    rec RECORD;
    recommendations TEXT[];
BEGIN
    -- Test 1: Basic query performance
    test_start := clock_timestamp();
    PERFORM * FROM transactions WHERE created_at >= NOW() - INTERVAL '7 days' LIMIT 100;
    test_end := clock_timestamp();
    
    RETURN NEXT SELECT 
        'Basic Query Test'::TEXT,
        EXTRACT(EPOCH FROM (test_end - test_start)) * 1000,
        'Completed'::TEXT,
        ARRAY['Add index on created_at', 'Consider query caching']::TEXT[];
    
    -- Test 2: Join performance
    test_start := clock_timestamp();
    PERFORM t.*, u.email FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.amount > 1000 LIMIT 100;
    test_end := clock_timestamp();
    
    RETURN NEXT SELECT 
        'Join Query Test'::TEXT,
        EXTRACT(EPOCH FROM (test_end - test_start)) * 1000,
        'Completed'::TEXT,
        ARRAY['Ensure foreign key indexes', 'Consider materialized views']::TEXT[];
    
    -- Test 3: Aggregate performance
    test_start := clock_timestamp();
    PERFORM DATE_TRUNC('day', created_at), COUNT(*), SUM(amount) FROM transactions GROUP BY DATE_TRUNC('day', created_at);
    test_end := clock_timestamp();
    
    RETURN NEXT SELECT 
        'Aggregate Query Test'::TEXT,
        EXTRACT(EPOCH FROM (test_end - test_start)) * 1000,
        'Completed'::TEXT,
        ARRAY['Add index on created_at', 'Consider pre-aggregation']::TEXT[];
    
    -- Test 4: Insert performance
    test_start := clock_timestamp();
    INSERT INTO transactions (user_id, amount, currency, status) VALUES (1, 100.00, 'USD', 'pending');
    test_end := clock_timestamp();
    
    RETURN NEXT SELECT 
        'Insert Test'::TEXT,
        EXTRACT(EPOCH FROM (test_end - test_start)) * 1000,
        'Completed'::TEXT,
        ARRAY['Consider batch inserts', 'Check trigger performance']::TEXT[];
    
    -- Test 5: Update performance
    test_start := clock_timestamp();
    UPDATE transactions SET status = 'completed' WHERE id = (SELECT id FROM transactions WHERE status = 'pending' LIMIT 1);
    test_end := clock_timestamp();
    
    RETURN NEXT SELECT 
        'Update Test'::TEXT,
        EXTRACT(EPOCH FROM (test_end - test_start)) * 1000,
        'Completed'::TEXT,
        ARRAY['Add index on status', 'Consider partial indexes']::TEXT[];
END;
$$ LANGUAGE plpgsql;

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_performance_test_data()
RETURNS VOID AS $$
BEGIN
    -- Clean up old performance logs (keep last 7 days)
    DELETE FROM query_performance_log WHERE timestamp < NOW() - INTERVAL '7 days';
    DELETE FROM index_performance_log WHERE timestamp < NOW() - INTERVAL '7 days';
    
    -- Clean up test data
    DELETE FROM transactions WHERE amount = 100.00 AND currency = 'USD' AND status = 'completed';
    
    RAISE NOTICE 'Performance test data cleaned up';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed)
-- GRANT USAGE ON SCHEMA performance_tests TO your_user;
-- GRANT ALL ON ALL TABLES IN SCHEMA performance_tests TO your_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA performance_tests TO your_user;

-- Example usage:
-- SELECT * FROM run_performance_tests();
-- SELECT * FROM analyze_index_usage();
-- SELECT * FROM analyze_query_performance();
-- SELECT * from generate_performance_recommendations();
-- PERFORM cleanup_performance_test_data();
