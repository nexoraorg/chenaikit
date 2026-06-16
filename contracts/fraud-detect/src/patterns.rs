use crate::storage::{get_transactions_in_window, TransactionRecord};
use soroban_sdk::{Address, Env, IntoVal, String, TryFromVal, Val, Vec};

#[derive(Clone, Debug)]
pub enum PatternType {
    HighVelocity,
    UnusualAmount,
    RoundNumberAmount,
    RapidSuccession,
    CircularTransactions,
    SuspiciousTiming,
    AddressRepetition,
}

#[derive(Clone, Debug)]
pub struct PatternMatch {
    pub pattern_type: PatternType,
    pub confidence: i64,
    pub description: String,
    pub related_transactions: Vec<u64>,
}

impl TryFromVal<Env, Val> for PatternMatch {
    type Error = soroban_sdk::Error;

    fn try_from_val(env: &Env, val: &Val) -> Result<Self, Self::Error> {
        let tuple: (u32, i64, String, Vec<u64>) = TryFromVal::try_from_val(env, val)?;

        let pattern_type = match tuple.0 {
            1 => PatternType::HighVelocity,
            2 => PatternType::UnusualAmount,
            3 => PatternType::RoundNumberAmount,
            4 => PatternType::RapidSuccession,
            5 => PatternType::CircularTransactions,
            6 => PatternType::SuspiciousTiming,
            7 => PatternType::AddressRepetition,
            _ => PatternType::HighVelocity,
        };

        Ok(PatternMatch {
            pattern_type,
            confidence: tuple.1,
            description: tuple.2,
            related_transactions: tuple.3,
        })
    }
}

impl IntoVal<Env, Val> for PatternMatch {
    fn into_val(&self, env: &Env) -> Val {
        let pattern_type_u32: u32 = match self.pattern_type {
            PatternType::HighVelocity => 1,
            PatternType::UnusualAmount => 2,
            PatternType::RoundNumberAmount => 3,
            PatternType::RapidSuccession => 4,
            PatternType::CircularTransactions => 5,
            PatternType::SuspiciousTiming => 6,
            PatternType::AddressRepetition => 7,
        };
        (
            pattern_type_u32,
            self.confidence,
            self.description.clone(),
            self.related_transactions.clone(),
        )
            .into_val(env)
    }
}

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

    if transactions.len() as u32 >= velocity_threshold {
        let confidence = (transactions.len() as i64 * 100 / velocity_threshold as i64).min(200);
        let description =
            String::from_str(env, "High velocity: multiple transactions in short time");

        let mut related_txs = Vec::new(env);
        for i in 0..transactions.len() {
            let tx = transactions.get(i).unwrap();
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

pub fn check_amount_patterns(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
    max_amount: i128,
    user_avg_amount: i128,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);

    for i in 0..transactions.len() {
        let tx = transactions.get(i).unwrap();
        if tx.amount > max_amount {
            let ratio = if user_avg_amount > 0 {
                tx.amount / user_avg_amount
            } else {
                0
            };
            let confidence = if ratio > 5 {
                500
            } else if ratio > 2 {
                300
            } else {
                0
            };
            let description = String::from_str(env, "Unusual amount: exceeds threshold");

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
                confidence: 70,
                description,
                related_transactions: related_txs,
            });
        }
    }

    patterns
}

pub fn check_timing_patterns(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);

    if transactions.len() < 2 {
        return patterns;
    }

    let mut rapid_succession_count = 0;
    let mut suspicious_times = Vec::new(env);

    for i in 1..transactions.len() {
        let time_diff =
            transactions.get(i).unwrap().timestamp - transactions.get(i - 1).unwrap().timestamp;

        if time_diff < 60 {
            rapid_succession_count += 1;
        }

        let hour = (transactions.get(i).unwrap().timestamp % 86400) / 3600;
        if (2..=4).contains(&hour) {
            suspicious_times.push_back(transactions.get(i).unwrap().timestamp);
        }
    }

    if rapid_succession_count >= 3 {
        let confidence = (rapid_succession_count as i64 * 10).min(100);
        let description = String::from_str(
            env,
            "Rapid succession: multiple transactions within 60 seconds",
        );

        let mut related_txs = Vec::new(env);
        for i in 0..transactions.len() {
            let tx = transactions.get(i).unwrap();
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
        let description =
            String::from_str(env, "Suspicious timing: transactions during unusual hours");

        patterns.push_back(PatternMatch {
            pattern_type: PatternType::SuspiciousTiming,
            confidence: 60,
            description,
            related_transactions: suspicious_times,
        });
    }

    patterns
}

pub fn check_circular_patterns(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);
    let mut address_pairs = Vec::new(env);

    for i in 0..transactions.len() {
        let tx = transactions.get(i).unwrap();
        address_pairs.push_back((tx.from_address.clone(), tx.to_address.clone()));
    }

    for i in 0..address_pairs.len() {
        for j in (i + 1)..address_pairs.len() {
            let (from1, to1) = address_pairs.get(i).unwrap();
            let (from2, to2) = address_pairs.get(j).unwrap();

            if from1 == to2 && to1 == from2 {
                let description = String::from_str(env, "Circular transaction pattern detected");

                let mut related_txs = Vec::new(env);
                related_txs.push_back(transactions.get(i).unwrap().timestamp);
                related_txs.push_back(transactions.get(j).unwrap().timestamp);

                patterns.push_back(PatternMatch {
                    pattern_type: PatternType::CircularTransactions,
                    confidence: 90,
                    description,
                    related_transactions: related_txs,
                });
            }
        }
    }

    patterns
}

pub fn check_address_repetition(
    env: &Env,
    transactions: &Vec<TransactionRecord>,
) -> Vec<PatternMatch> {
    let mut patterns = Vec::new(env);
    let mut address_counts = soroban_sdk::Map::<Address, u32>::new(env);

    for i in 0..transactions.len() {
        let tx = transactions.get(i).unwrap();
        let count = address_counts.get(tx.to_address.clone()).unwrap_or(0);
        address_counts.set(tx.to_address.clone(), count + 1);
    }

    for (address, count) in address_counts.iter() {
        if count >= 5 {
            let confidence = (count as i64 * 20 / 100).min(100);
            let description = String::from_str(
                env,
                "Address repetition: multiple transactions to same address",
            );

            let mut related_txs = Vec::new(env);
            for i in 0..transactions.len() {
                let tx = transactions.get(i).unwrap();
                if tx.to_address == address {
                    related_txs.push_back(tx.timestamp);
                }
            }

            patterns.push_back(PatternMatch {
                pattern_type: PatternType::AddressRepetition,
                confidence,
                description,
                related_transactions: related_txs,
            });
        }
    }

    patterns
}

fn is_round_number(amount: i128) -> bool {
    amount % 1000 == 0 && amount > 0
}

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
    let window_start = current_time.saturating_sub(3600);
    let recent_transactions = get_transactions_in_window(env, user, window_start, current_time);

    let amount_patterns = check_amount_patterns(env, &recent_transactions, max_amount, 0);
    let timing_patterns = check_timing_patterns(env, &recent_transactions);
    let circular_patterns = check_circular_patterns(env, &recent_transactions);
    let repetition_patterns = check_address_repetition(env, &recent_transactions);

    for i in 0..velocity_patterns.len() {
        let pattern = velocity_patterns.get(i).unwrap();
        all_patterns.push_back(pattern.clone());
    }
    for i in 0..amount_patterns.len() {
        let pattern = amount_patterns.get(i).unwrap();
        all_patterns.push_back(pattern.clone());
    }
    for i in 0..timing_patterns.len() {
        let pattern = timing_patterns.get(i).unwrap();
        all_patterns.push_back(pattern.clone());
    }
    for i in 0..circular_patterns.len() {
        let pattern = circular_patterns.get(i).unwrap();
        all_patterns.push_back(pattern.clone());
    }
    for i in 0..repetition_patterns.len() {
        let pattern = repetition_patterns.get(i).unwrap();
        all_patterns.push_back(pattern.clone());
    }

    all_patterns
}
