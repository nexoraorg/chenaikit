//! Comprehensive risk scoring and statistical anomaly detection engine.

use crate::storage::{get_transaction_history, get_transactions_in_window};
use crate::types::{AnomalyDetection, PatternMatch, RiskScore, TransactionRecord};
use soroban_sdk::{Address, Env, String, Vec};

/// Calculates score contribution based on velocity.
pub fn calculate_velocity_score(
    env: &Env,
    user: &Address,
    current_time: u64,
    velocity_threshold: u32,
    velocity_window: u64,
) -> (u32, Vec<String>) {
    let mut factors = Vec::new(env);
    let window_start = current_time.saturating_sub(velocity_window);
    let transactions = get_transactions_in_window(env, user, window_start, current_time);

    let count = transactions.len();
    if count == 0 || velocity_threshold == 0 {
        return (0, factors);
    }

    if count >= velocity_threshold {
        factors.push_back(String::from_str(env, "Velocity threshold breached"));
        let excess = count.saturating_sub(velocity_threshold);
        let score = (30u32).saturating_add(excess.min(10) * 2).min(50);
        (score, factors)
    } else if count >= (velocity_threshold / 2) {
        factors.push_back(String::from_str(env, "Elevated transaction velocity"));
        (15, factors)
    } else {
        (0, factors)
    }
}

/// Calculates score contribution based on transaction amount.
pub fn calculate_amount_score(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
    max_amount: i128,
    user_avg_amount: i128,
) -> (u32, Vec<String>) {
    let mut factors = Vec::new(env);
    let mut score: u32 = 0;

    for tx in transactions.iter() {
        if tx.amount > max_amount {
            factors.push_back(String::from_str(env, "Amount exceeds standard threshold"));
            score = score.saturating_add(30);

            if user_avg_amount > 0 {
                let ratio = tx.amount.checked_div(user_avg_amount).unwrap_or(0);
                if ratio > 10 {
                    factors.push_back(String::from_str(
                        env,
                        "Amount exceeds 10x historical average",
                    ));
                    score = score.saturating_add(20);
                } else if ratio > 5 {
                    factors.push_back(String::from_str(
                        env,
                        "Amount exceeds 5x historical average",
                    ));
                    score = score.saturating_add(10);
                }
            }
        }
    }

    (score.min(40), factors)
}

/// Calculates score contribution based on execution timing.
pub fn calculate_timing_score(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
) -> (u32, Vec<String>) {
    let mut factors = Vec::new(env);
    let mut score: u32 = 0;

    for tx in transactions.iter() {
        let hour = (tx.timestamp % 86400) / 3600;
        if (2..=4).contains(&hour) {
            factors.push_back(String::from_str(env, "Off-peak execution hour"));
            score = score.saturating_add(10);
        }
    }

    (score.min(20), factors)
}

/// Calculates score contribution based on matched heuristic patterns.
pub fn calculate_pattern_score(env: &Env, patterns: &Vec<PatternMatch>) -> (u32, Vec<String>) {
    let mut factors = Vec::new(env);
    let mut score: u32 = 0;

    for p in patterns.iter() {
        factors.push_back(p.description.clone());
        let contribution = ((p.confidence.max(0) as u32) * 15) / 100;
        score = score.saturating_add(contribution);
    }

    (score.min(40), factors)
}

/// Calculates historical score based on account age and amount variance.
pub fn calculate_historical_score(
    env: &Env,
    user: &Address,
    current_time: u64,
) -> (u32, Vec<String>) {
    let mut factors = Vec::new(env);
    let history = get_transaction_history(env, user);

    if history.is_empty() {
        factors.push_back(String::from_str(env, "No prior transaction history"));
        return (15, factors);
    }

    let thirty_days_ago = current_time.saturating_sub(2_592_000);
    let recent = get_transactions_in_window(env, user, thirty_days_ago, current_time);

    let count = recent.len();
    if count < 3 {
        factors.push_back(String::from_str(env, "Low transaction history"));
        return (10, factors);
    }

    let mut total_amount: i128 = 0;
    for tx in recent.iter() {
        total_amount = total_amount.saturating_add(tx.amount);
    }
    let avg_amount = total_amount.checked_div(count as i128).unwrap_or(0);

    let variance_score = calculate_amount_variance(&recent, avg_amount);
    if variance_score > 15 {
        factors.push_back(String::from_str(env, "High transaction amount volatility"));
    }

    let first_tx = history.get(0).unwrap();
    let account_age_days = current_time.saturating_sub(first_tx.timestamp) / 86400;
    let age_score: u32 = if account_age_days < 7 {
        factors.push_back(String::from_str(env, "New account under 7 days old"));
        15
    } else if account_age_days < 30 {
        8
    } else {
        0
    };

    ((variance_score + age_score).min(30), factors)
}

/// Safe integer variance calculation for transaction amounts.
fn calculate_amount_variance(transactions: &Vec<TransactionRecord>, avg_amount: i128) -> u32 {
    let count = transactions.len();
    if count == 0 || avg_amount == 0 {
        return 0;
    }

    let mut variance_sum: i128 = 0;
    for tx in transactions.iter() {
        let diff = if tx.amount > avg_amount {
            tx.amount.saturating_sub(avg_amount)
        } else {
            avg_amount.saturating_sub(tx.amount)
        };
        let squared = diff.saturating_mul(diff);
        variance_sum = variance_sum.saturating_add(squared);
    }

    let variance = variance_sum.checked_div(count as i128).unwrap_or(0);
    let std_dev = isqrt(variance);

    let cv = (std_dev.saturating_mul(100))
        .checked_div(avg_amount)
        .unwrap_or(0);

    if cv > 200 {
        25
    } else if cv > 100 {
        15
    } else if cv > 50 {
        8
    } else {
        0
    }
}

/// Safe integer square root using binary search.
fn isqrt(val: i128) -> i128 {
    if val <= 0 {
        return 0;
    }
    if val == 1 {
        return 1;
    }
    let mut low = 1i128;
    let mut high = val.min(3_037_000_499); // sqrt(i128::MAX) is ~ 1.84 * 10^19, safe for squaring
    let mut ans = 1i128;

    while low <= high {
        let mid = low + (high - low) / 2;
        if let Some(sq) = mid.checked_mul(mid) {
            if sq <= val {
                ans = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        } else {
            high = mid - 1;
        }
    }
    ans
}

/// Statistical anomaly detection comparing current transaction against historical baseline.
pub fn detect_anomalies(
    env: &Env,
    user: &Address,
    current_tx: &TransactionRecord,
    current_time: u64,
) -> AnomalyDetection {
    let mut factors = Vec::new(env);
    let mut score: i64 = 0;

    let window_start = current_time.saturating_sub(86400 * 14);
    let recent = get_transactions_in_window(env, user, window_start, current_time);

    if recent.len() >= 5 {
        let mut total: i128 = 0;
        for tx in recent.iter() {
            total = total.saturating_add(tx.amount);
        }
        let avg = total.checked_div(recent.len() as i128).unwrap_or(0);

        if avg > 0 && current_tx.amount > avg {
            let mult = (current_tx.amount.checked_div(avg).unwrap_or(0)) as i64;
            if mult >= 5 {
                score = score.saturating_add(50);
                factors.push_back(String::from_str(
                    env,
                    "Transaction amount deviates 5x above baseline",
                ));
            } else if mult >= 3 {
                score = score.saturating_add(25);
                factors.push_back(String::from_str(
                    env,
                    "Transaction amount deviates 3x above baseline",
                ));
            }
        }
    }

    AnomalyDetection {
        is_anomalous: score >= 50,
        anomaly_score: score,
        deviation_factors: factors,
    }
}

/// Aggregates all scoring components into a comprehensive risk score normalized to 0..=100.
#[allow(clippy::too_many_arguments)]
pub fn calculate_comprehensive_risk_score(
    env: &Env,
    user: &Address,
    current_tx: &TransactionRecord,
    patterns: &Vec<PatternMatch>,
    current_time: u64,
    velocity_threshold: u32,
    velocity_window: u64,
    max_amount: i128,
) -> RiskScore {
    let (v_score, v_factors) =
        calculate_velocity_score(env, user, current_time, velocity_threshold, velocity_window);

    let single = Vec::from_slice(env, core::slice::from_ref(current_tx));
    let history = get_transaction_history(env, user);
    let user_avg = if !history.is_empty() {
        let mut t: i128 = 0;
        for h in history.iter() {
            t = t.saturating_add(h.amount);
        }
        t.checked_div(history.len() as i128).unwrap_or(0)
    } else {
        0
    };

    let (a_score, a_factors) = calculate_amount_score(env, &single, max_amount, user_avg);
    let (t_score, t_factors) = calculate_timing_score(env, &single);
    let (p_score, p_factors) = calculate_pattern_score(env, patterns);
    let (h_score, h_factors) = calculate_historical_score(env, user, current_time);

    let mut all_factors = Vec::new(env);
    for f in v_factors.iter() {
        all_factors.push_back(f);
    }
    for f in a_factors.iter() {
        all_factors.push_back(f);
    }
    for f in t_factors.iter() {
        all_factors.push_back(f);
    }
    for f in p_factors.iter() {
        all_factors.push_back(f);
    }
    for f in h_factors.iter() {
        all_factors.push_back(f);
    }

    let sum = v_score
        .saturating_add(a_score)
        .saturating_add(t_score)
        .saturating_add(p_score)
        .saturating_add(h_score);

    RiskScore {
        total_score: sum.min(100),
        velocity_score: v_score,
        amount_score: a_score,
        timing_score: t_score,
        pattern_score: p_score,
        historical_score: h_score,
        risk_factors: all_factors,
    }
}
