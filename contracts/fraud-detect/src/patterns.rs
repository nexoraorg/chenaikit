//! Heuristic pattern recognition with boundary and overflow safety.

use crate::storage::get_transactions_in_window;
use crate::types::{PatternMatch, PatternType, TransactionRecord};
use soroban_sdk::{Address, Env, Map, String, Vec};

/// Detects high velocity transaction patterns within a configured time window.
pub fn check_velocity_patterns(
    env: &Env,
    user: &Address,
    current_time: u64,
    velocity_threshold: u32,
    velocity_window: u64,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);
    let window_start = current_time.saturating_sub(velocity_window);
    let transactions = get_transactions_in_window(env, user, window_start, current_time);

    let tx_count = transactions.len();

    if tx_count >= velocity_threshold {
        let confidence = if velocity_threshold > 0 {
            let ratio = (tx_count as i64)
                .saturating_mul(100)
                .checked_div(velocity_threshold as i64)
                .unwrap_or(100);
            ratio.min(100)
        } else {
            100
        };

        let description = String::from_str(
            env,
            "High velocity: excessive transactions within time window",
        );

        let mut related_txs = Vec::new(env);
        for tx in transactions.iter() {
            related_txs.push_back(tx.timestamp);
        }

        patterns.push_back(PatternMatch {
            pattern_type: PatternType::HighVelocity,
            confidence,
            description,
            related_transactions: related_txs,
        });
    }

    patterns
}

/// Evaluates transactions for amounts exceeding thresholds or exhibiting round number structures.
pub fn check_amount_patterns(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
    max_amount: i128,
    user_avg_amount: i128,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);

    for tx in transactions.iter() {
        if tx.amount > max_amount {
            let confidence = if user_avg_amount > 0 {
                let ratio = tx.amount.checked_div(user_avg_amount).unwrap_or(0);
                if ratio > 5 {
                    90
                } else if ratio > 2 {
                    70
                } else {
                    50
                }
            } else {
                60
            };

            let description = String::from_str(
                env,
                "Unusual amount: transaction exceeds configured threshold",
            );
            let mut related_txs = Vec::new(env);
            related_txs.push_back(tx.timestamp);

            patterns.push_back(PatternMatch {
                pattern_type: PatternType::UnusualAmount,
                confidence,
                description,
                related_transactions: related_txs,
            });
        }

        if is_round_number(tx.amount) {
            let description = String::from_str(env, "Round number amount detected");
            let mut related_txs = Vec::new(env);
            related_txs.push_back(tx.timestamp);

            patterns.push_back(PatternMatch {
                pattern_type: PatternType::RoundNumberAmount,
                confidence: 40,
                description,
                related_transactions: related_txs,
            });
        }
    }

    patterns
}

/// Analyzes timing patterns for rapid succession and unusual operating hours.
pub fn check_timing_patterns(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);

    if transactions.len() < 2 {
        return patterns;
    }

    let mut rapid_succession_count: u32 = 0;
    let mut suspicious_times = Vec::new(env);

    for i in 1..transactions.len() {
        let prev_tx = transactions.get(i - 1).unwrap();
        let curr_tx = transactions.get(i).unwrap();
        let time_diff = curr_tx.timestamp.saturating_sub(prev_tx.timestamp);

        if time_diff < 60 {
            rapid_succession_count = rapid_succession_count.saturating_add(1);
        }

        let hour = (curr_tx.timestamp % 86400) / 3600;
        if (2..=4).contains(&hour) {
            suspicious_times.push_back(curr_tx.timestamp);
        }
    }

    if rapid_succession_count >= 3 {
        let confidence = (rapid_succession_count as i64 * 20).min(100);
        let description = String::from_str(
            env,
            "Rapid succession: multiple transactions executed within 60 seconds",
        );

        let mut related_txs = Vec::new(env);
        for tx in transactions.iter() {
            related_txs.push_back(tx.timestamp);
        }

        patterns.push_back(PatternMatch {
            pattern_type: PatternType::RapidSuccession,
            confidence,
            description,
            related_transactions: related_txs,
        });
    }

    if suspicious_times.len() >= 2 {
        let description = String::from_str(
            env,
            "Suspicious timing: cluster of transactions during off-peak hours",
        );

        patterns.push_back(PatternMatch {
            pattern_type: PatternType::SuspiciousTiming,
            confidence: 50,
            description,
            related_transactions: suspicious_times,
        });
    }

    patterns
}

/// Identifies circular back-and-forth transaction pairs between identical participants.
pub fn check_circular_patterns(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);
    let count = transactions.len();

    if count < 2 {
        return patterns;
    }

    for i in 0..count {
        for j in (i + 1)..count {
            let tx_a = transactions.get(i).unwrap();
            let tx_b = transactions.get(j).unwrap();

            if tx_a.from_address == tx_b.to_address && tx_a.to_address == tx_b.from_address {
                let description =
                    String::from_str(env, "Circular transaction cycle detected between parties");
                let mut related = Vec::new(env);
                related.push_back(tx_a.timestamp);
                related.push_back(tx_b.timestamp);

                patterns.push_back(PatternMatch {
                    pattern_type: PatternType::CircularTransactions,
                    confidence: 85,
                    description,
                    related_transactions: related,
                });
            }
        }
    }

    patterns
}

/// Detects repetitive transfers concentrated on the same destination address.
pub fn check_address_repetition(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);
    let mut counts = Map::<Address, u32>::new(env);

    for tx in transactions.iter() {
        let current = counts.get(tx.to_address.clone()).unwrap_or(0);
        counts.set(tx.to_address.clone(), current.saturating_add(1));
    }

    for (addr, count) in counts.iter() {
        if count >= 5 {
            let confidence = (count as i64 * 15).min(100);
            let description = String::from_str(
                env,
                "Address repetition: concentrated transactions to single counterparty",
            );

            let mut related = Vec::new(env);
            for tx in transactions.iter() {
                if tx.to_address == addr {
                    related.push_back(tx.timestamp);
                }
            }

            patterns.push_back(PatternMatch {
                pattern_type: PatternType::AddressRepetition,
                confidence,
                description,
                related_transactions: related,
            });
        }
    }

    patterns
}

fn is_round_number(amount: i128) -> bool {
    amount > 0 && amount % 1000 == 0
}

/// Runs all heuristic pattern analyzers against recent activity.
pub fn analyze_all_patterns(
    env: &Env,
    user: &Address,
    current_time: u64,
    velocity_threshold: u32,
    velocity_window: u64,
    max_amount: i128,
) -> Vec<PatternMatch> {
    let mut all_patterns = Vec::new(env);

    let velocity_patterns =
        check_velocity_patterns(env, user, current_time, velocity_threshold, velocity_window);
    let window_start = current_time.saturating_sub(velocity_window.max(3600));
    let recent_transactions = get_transactions_in_window(env, user, window_start, current_time);

    let amount_patterns = check_amount_patterns(env, &recent_transactions, max_amount, 0);
    let timing_patterns = check_timing_patterns(env, &recent_transactions);
    let circular_patterns = check_circular_patterns(env, &recent_transactions);
    let repetition_patterns = check_address_repetition(env, &recent_transactions);

    for p in velocity_patterns.iter() {
        all_patterns.push_back(p);
    }
    for p in amount_patterns.iter() {
        all_patterns.push_back(p);
    }
    for p in timing_patterns.iter() {
        all_patterns.push_back(p);
    }
    for p in circular_patterns.iter() {
        all_patterns.push_back(p);
    }
    for p in repetition_patterns.iter() {
        all_patterns.push_back(p);
    }

    all_patterns
}
