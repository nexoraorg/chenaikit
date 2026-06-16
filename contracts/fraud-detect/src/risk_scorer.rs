use crate::patterns::{PatternMatch, PatternType};
use crate::storage::{get_transaction_history, get_transactions_in_window, TransactionRecord};
use soroban_sdk::{Address, Env, String, Vec};

#[derive(Clone)]
pub struct RiskScore {
    pub total_score: u32,
    pub velocity_score: u32,
    pub amount_score: u32,
    pub timing_score: u32,
    pub pattern_score: u32,
    pub historical_score: u32,
    pub risk_factors: Vec<String>,
}

#[derive(Clone)]
pub struct AnomalyDetection {
    pub is_anomalous: bool,
    pub anomaly_score: i64,
    pub deviation_factors: Vec<String>,
}

impl Default for RiskScore {
    fn default() -> Self {
        Self {
            total_score: 0,
            velocity_score: 0,
            amount_score: 0,
            timing_score: 0,
            pattern_score: 0,
            historical_score: 0,
            risk_factors: Vec::new(&Env::default()),
        }
    }
}

pub fn calculate_velocity_score(
    env: &Env,
    user: &Address,
    current_time: u64,
    velocity_threshold: u32,
    velocity_window: u64,
) -> (u32, Vec<String>) {
    let window_start = current_time.saturating_sub(velocity_window);

    let transactions = get_transactions_in_window(env, user, window_start, current_time);
    let mut risk_factors = Vec::new(env);

    if transactions.is_empty() {
        return (0, risk_factors);
    }

    let transaction_count = transactions.len() as u32;
    let base_score = if transactions.len() as u32 >= velocity_threshold {
        ((transaction_count - velocity_threshold) * 10).min(50)
    } else {
        0
    };

    if transaction_count > velocity_threshold * 2 {
        risk_factors.push_back(String::from_str(env, "Extremely high transaction velocity"));
    } else if transaction_count > velocity_threshold {
        risk_factors.push_back(String::from_str(env, "High transaction velocity"));
    }

    let time_span = if transactions.len() > 1 {
        transactions.last().unwrap().timestamp - transactions.first().unwrap().timestamp
    } else {
        0
    };

    let frequency_bonus = if time_span > 0 && time_span < 300 {
        20
    } else if time_span > 0 && time_span < 600 {
        10
    } else {
        0
    };

    if frequency_bonus > 0 {
        risk_factors.push_back(String::from_str(env, "High frequency transactions"));
    }

    (base_score + frequency_bonus, risk_factors)
}

pub fn calculate_amount_score(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
    max_amount: i128,
    user_avg_amount: i128,
) -> (u32, Vec<String>) {
    let mut risk_factors = Vec::new(env);
    let mut total_score = 0u32;

    for tx in transactions.iter() {
        let mut tx_score = 0u32;

        if tx.amount > max_amount {
            tx_score += 30;
            risk_factors.push_back(String::from_str(
                env,
                "Transaction amount exceeds maximum threshold",
            ));
        }

        if user_avg_amount > 0 {
            let ratio = tx.amount as f64 / user_avg_amount as f64;
            if ratio > 5.0 {
                tx_score += 25;
                risk_factors.push_back(String::from_str(
                    env,
                    "Transaction amount significantly higher than user average",
                ));
            } else if ratio > 2.0 {
                tx_score += 15;
                risk_factors.push_back(String::from_str(
                    env,
                    "Transaction amount moderately higher than user average",
                ));
            }
        }

        if tx.amount == 0 {
            tx_score += 10;
            risk_factors.push_back(String::from_str(env, "Zero amount transaction"));
        }

        total_score = total_score.saturating_add(tx_score);
    }

    (total_score.min(50), risk_factors)
}

pub fn calculate_timing_score(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
) -> (u32, Vec<String>) {
    let mut risk_factors = Vec::new(env);
    let mut score = 0u32;

    for tx in transactions.iter() {
        let hour = (tx.timestamp % 86400) / 3600;

        if (2..=4).contains(&hour) {
            score += 15;
            risk_factors.push_back(String::from_str(
                env,
                "Transaction during unusual hours (2AM-4AM)",
            ));
        }

        let day_of_week = (tx.timestamp / 86400) % 7;
        if day_of_week == 0 || day_of_week == 6 {
            score += 5;
        }
    }

    if transactions.len() > 1 {
        for i in 1..transactions.len() {
            let time_diff =
                transactions.get(i).unwrap().timestamp - transactions.get(i - 1).unwrap().timestamp;
            if time_diff < 30 {
                score += 20;
                risk_factors.push_back(String::from_str(
                    env,
                    "Rapid succession transactions (< 30s)",
                ));
                break;
            } else if time_diff < 60 {
                score += 10;
                risk_factors.push_back(String::from_str(
                    env,
                    "Quick succession transactions (< 60s)",
                ));
            }
        }
    }

    (score.min(40), risk_factors)
}

pub fn calculate_pattern_score(env: &Env, patterns: &Vec<PatternMatch>) -> (u32, Vec<String>) {
    let mut risk_factors = Vec::new(env);
    let mut total_score = 0u32;

    for i in 0..patterns.len() {
        let pattern = patterns.get(i).unwrap();
        let pattern_score = (pattern.confidence * 20 / 100) as u32;
        total_score += pattern_score;

        match pattern.pattern_type {
            PatternType::HighVelocity => {
                risk_factors.push_back(String::from_str(env, "High velocity pattern detected"));
            }
            PatternType::UnusualAmount => {
                risk_factors.push_back(String::from_str(env, "Unusual amount pattern detected"));
            }
            PatternType::RoundNumberAmount => {
                risk_factors.push_back(String::from_str(
                    env,
                    "Round number amount pattern detected",
                ));
            }
            PatternType::RapidSuccession => {
                risk_factors.push_back(String::from_str(env, "Rapid succession pattern detected"));
            }
            PatternType::CircularTransactions => {
                risk_factors.push_back(String::from_str(
                    env,
                    "Circular transaction pattern detected",
                ));
                total_score += 10;
            }
            PatternType::SuspiciousTiming => {
                risk_factors.push_back(String::from_str(env, "Suspicious timing pattern detected"));
            }
            PatternType::AddressRepetition => {
                risk_factors
                    .push_back(String::from_str(env, "Address repetition pattern detected"));
            }
        }
    }

    (total_score.min(60), risk_factors)
}

pub fn calculate_historical_score(
    env: &Env,
    user: &Address,
    current_time: u64,
) -> (u32, Vec<String>) {
    let mut risk_factors = Vec::new(env);
    let history = get_transaction_history(env, user);

    if history.is_empty() {
        risk_factors.push_back(String::from_str(env, "No transaction history"));
        return (20, risk_factors);
    }

    let thirty_days_ago = current_time.saturating_sub(2_592_000);

    let recent_transactions = get_transactions_in_window(env, user, thirty_days_ago, current_time);

    if recent_transactions.len() < 5 {
        risk_factors.push_back(String::from_str(env, "Low transaction activity"));
        return (15, risk_factors);
    }

    let mut total_amount = 0i128;
    let mut transaction_count = 0u32;

    for tx in recent_transactions.iter() {
        total_amount += tx.amount;
        transaction_count += 1;
    }

    let avg_amount = if transaction_count > 0 {
        total_amount / transaction_count as i128
    } else {
        0i128
    };

    let variance_score = calculate_amount_variance(env, &recent_transactions, avg_amount);

    if variance_score > 30 {
        risk_factors.push_back(String::from_str(
            env,
            "High variance in transaction amounts",
        ));
    }

    let account_age_days = (current_time - history.first().unwrap().timestamp) / 86400;
    let age_score = if account_age_days < 7 {
        25
    } else if account_age_days < 30 {
        15
    } else if account_age_days < 90 {
        5
    } else {
        0
    };

    if age_score > 0 {
        risk_factors.push_back(String::from_str(env, "New account detected"));
    }

    (variance_score + age_score, risk_factors)
}

fn calculate_amount_variance(
    _env: &Env,
    transactions: &Vec<TransactionRecord>,
    avg_amount: i128,
) -> u32 {
    if transactions.is_empty() || avg_amount == 0 {
        return 0;
    }

    let mut variance_sum = 0i128;
    let mut count = 0u32;

    for tx in transactions.iter() {
        let diff = if tx.amount > avg_amount {
            tx.amount - avg_amount
        } else {
            avg_amount - tx.amount
        };
        variance_sum += diff * diff;
        count += 1;
    }

    if count == 0 {
        return 0;
    }

    let variance = variance_sum / count as i128;
    let std_dev = if variance > 0 {
        // Simple integer approximation of square root
        let x = variance;
        let mut y = 1i128;
        while y < x {
            y += 1;
            if y * y > variance {
                y -= 1;
                break;
            }
        }
        y
    } else {
        0i128
    };

    let coefficient_of_variation = if avg_amount > 0 {
        (std_dev * 100 / avg_amount).min(1000)
    } else {
        0
    };

    if coefficient_of_variation > 200 {
        30
    } else if coefficient_of_variation > 100 {
        20
    } else if coefficient_of_variation > 50 {
        10
    } else {
        0
    }
}

pub fn detect_anomalies(
    env: &Env,
    user: &Address,
    current_transaction: &TransactionRecord,
    current_time: u64,
) -> AnomalyDetection {
    let history = get_transaction_history(env, user);
    let mut deviation_factors = Vec::new(env);
    let mut anomaly_score = 0i64;

    if history.len() < 10 {
        return AnomalyDetection {
            is_anomalous: false,
            anomaly_score: 0,
            deviation_factors,
        };
    }

    let recent_history =
        get_transactions_in_window(env, user, current_time - 86400 * 7, current_time);

    if recent_history.is_empty() {
        return AnomalyDetection {
            is_anomalous: false,
            anomaly_score: 0,
            deviation_factors,
        };
    }

    let mut total_amount = 0i128;
    for i in 0..recent_history.len() {
        total_amount += recent_history.get(i).unwrap().amount;
    }
    let avg_amount = total_amount / recent_history.len() as i128;

    if avg_amount > 0 {
        let amount_deviation = if current_transaction.amount > avg_amount {
            current_transaction.amount / avg_amount - 1
        } else {
            avg_amount / current_transaction.amount - 1
        };
        if amount_deviation > 3 {
            anomaly_score += (amount_deviation * 40) as i64;
            deviation_factors.push_back(String::from_str(env, "Amount deviation detected"));
        }
    }

    let mut time_intervals = Vec::new(env);
    for i in 1..recent_history.len() {
        let interval =
            recent_history.get(i).unwrap().timestamp - recent_history.get(i - 1).unwrap().timestamp;
        time_intervals.push_back(interval);
    }

    if !time_intervals.is_empty() {
        let mut total_interval = 0u64;
        for i in 0..time_intervals.len() {
            total_interval += time_intervals.get(i).unwrap();
        }
        let avg_interval = total_interval / time_intervals.len() as u64;

        if recent_history.len() > 1 {
            let last_interval = recent_history
                .get(recent_history.len() - 1)
                .unwrap()
                .timestamp
                - recent_history
                    .get(recent_history.len() - 2)
                    .unwrap()
                    .timestamp;

            if avg_interval > 0 {
                let timing_deviation = if last_interval > avg_interval {
                    last_interval / avg_interval - 1
                } else {
                    avg_interval / last_interval - 1
                };
                if timing_deviation > 2 {
                    anomaly_score += (timing_deviation * 30) as i64;
                    deviation_factors.push_back(String::from_str(env, "Timing deviation detected"));
                }
            }
        }
    }

    let is_anomalous = anomaly_score > 80;

    AnomalyDetection {
        is_anomalous,
        anomaly_score,
        deviation_factors,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn calculate_comprehensive_risk_score(
    env: &Env,
    user: &Address,
    current_transaction: &TransactionRecord,
    patterns: &Vec<PatternMatch>,
    current_time: u64,
    velocity_threshold: u32,
    velocity_window: u64,
    max_amount: i128,
) -> RiskScore {
    let (velocity_score, velocity_factors) =
        calculate_velocity_score(env, user, current_time, velocity_threshold, velocity_window);

    let single_tx = Vec::from_slice(env, core::slice::from_ref(current_transaction));
    let history = get_transaction_history(env, user);
    let user_avg_amount = if history.is_empty() {
        0i128
    } else {
        let mut total = 0i128;
        for i in 0..history.len() {
            total += history.get(i).unwrap().amount;
        }
        total / history.len() as i128
    };

    let (amount_score, amount_factors) =
        calculate_amount_score(env, &single_tx, max_amount, user_avg_amount);

    let (timing_score, timing_factors) = calculate_timing_score(env, &single_tx);

    let (pattern_score, pattern_factors) = calculate_pattern_score(env, patterns);

    let (historical_score, historical_factors) =
        calculate_historical_score(env, user, current_time);

    let mut all_factors = Vec::new(env);
    for factor in velocity_factors.iter() {
        all_factors.push_back(factor.clone());
    }
    for factor in amount_factors.iter() {
        all_factors.push_back(factor.clone());
    }
    for factor in timing_factors.iter() {
        all_factors.push_back(factor.clone());
    }
    for factor in pattern_factors.iter() {
        all_factors.push_back(factor.clone());
    }
    for factor in historical_factors.iter() {
        all_factors.push_back(factor.clone());
    }

    let total_score =
        velocity_score + amount_score + timing_score + pattern_score + historical_score;

    RiskScore {
        total_score: total_score.min(100),
        velocity_score,
        amount_score,
        timing_score,
        pattern_score,
        historical_score,
        risk_factors: all_factors,
    }
}
