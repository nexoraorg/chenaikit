use soroban_sdk::{Env, Vec};
use crate::{SubmissionStatus, SubmissionPhase, storage};
use crate::commit_reveal::{get_reveals_map, is_reveal_phase_complete};
use crate::events::emit_aggregation_finalized;
use crate::storage::get_config_or_default;

/// Finalize aggregation after reveal phase
pub fn finalize(env: &Env, request_id: u64) {
    // Check if reveal phase is complete
    if !is_reveal_phase_complete(env, request_id) {
        panic!("reveal phase not complete");
    }
    
    // Get all reveals for this request
    let reveals = get_reveals_map(env);
    let mut scores = Vec::new(env);
    
    for ((req_id, _node), reveal_data) in reveals {
        if req_id == request_id {
            scores.push_back(reveal_data.score);
        }
    }
    
    // Calculate aggregate score using median
    let final_score = calculate_median(env, &scores);
    
    // Update submission status
    let mut submissions = storage::get_submissions_map(env);
    let mut status = storage::get_submissions_map(env).get(request_id)
        .expect("submission not found");
    
    status.phase = SubmissionPhase::Finalized;
    status.final_score = Some(final_score);
    status.finalized_at = Some(env.ledger().timestamp());
    
    submissions.set(request_id, status);
    storage::set_submissions_map(env, &submissions);
    
    emit_aggregation_finalized(env, request_id, final_score, scores.len());
}

/// Calculate median of scores
pub fn calculate_median(env: &Env, scores: &Vec<i128>) -> i128 {
    if scores.is_empty() {
        panic!("cannot calculate median of empty set");
    }
    
    // Sort scores
    let mut sorted = Vec::new(env);
    for score in scores {
        sorted.push_back(*score);
    }
    
    // Simple bubble sort (inefficient but works for small sets)
    let len = sorted.len();
    for i in 0..len {
        for j in 0..len - i - 1 {
            if sorted.get(j) > sorted.get(j + 1) {
                let temp = sorted.get(j);
                sorted.set(j, sorted.get(j + 1));
                sorted.set(j + 1, temp);
            }
        }
    }
    
    // Get median
    let mid = len / 2;
    if len % 2 == 0 {
        // Even number: average of middle two
        let a = sorted.get(mid - 1);
        let b = sorted.get(mid);
        (a + b) / 2
    } else {
        // Odd number: middle element
        sorted.get(mid)
    }
}

/// Calculate trimmed mean (remove outliers)
pub fn calculate_trimmed_mean(env: &Env, scores: &Vec<i128>, trim_percentage: u32) -> i128 {
    if scores.is_empty() {
        panic!("cannot calculate trimmed mean of empty set");
    }
    
    let len = scores.len();
    let trim_count = (len as u32 * trim_percentage / 100) as usize;
    
    if trim_count * 2 >= len {
        // Trim too much, fall back to median
        return calculate_median(env, scores);
    }
    
    // Sort and trim
    let mut sorted = Vec::new(env);
    for score in scores {
        sorted.push_back(*score);
    }
    
    // Simple bubble sort
    let sort_len = sorted.len();
    for i in 0..sort_len {
        for j in 0..sort_len - i - 1 {
            if sorted.get(j) > sorted.get(j + 1) {
                let temp = sorted.get(j);
                sorted.set(j, sorted.get(j + 1));
                sorted.set(j + 1, temp);
            }
        }
    }
    
    // Calculate mean of middle portion
    let mut sum: i128 = 0;
    let count = len - 2 * trim_count;
    
    for i in trim_count..len - trim_count {
        sum += sorted.get(i);
    }
    
    sum / count as i128
}

/// Calculate variance from mean
pub fn calculate_variance(env: &Env, scores: &Vec<i128>, mean: i128) -> i128 {
    if scores.is_empty() {
        return 0;
    }
    
    let mut sum_squared_diff: i128 = 0;
    
    for score in scores {
        let diff = *score - mean;
        let squared_diff = diff * diff;
        sum_squared_diff += squared_diff;
    }
    
    sum_squared_diff / scores.len() as i128
}

/// Check if scores are within tolerance
pub fn are_scores_within_tolerance(env: &Env, scores: &Vec<i128>, tolerance: i128) -> bool {
    if scores.is_empty() {
        return true;
    }
    
    let mean = calculate_mean(env, scores);
    let variance = calculate_variance(env, scores, mean);
    let std_dev = if variance > 0 {
        // Integer square root approximation
        isqrt(variance)
    } else {
        0
    };
    
    std_dev <= tolerance
}

/// Calculate mean
pub fn calculate_mean(env: &Env, scores: &Vec<i128>) -> i128 {
    if scores.is_empty() {
        panic!("cannot calculate mean of empty set");
    }
    
    let mut sum: i128 = 0;
    for score in scores {
        sum += *score;
    }
    
    sum / scores.len() as i128
}

/// Integer square root (Newton's method)
fn isqrt(n: i128) -> i128 {
    if n <= 0 {
        return 0;
    }
    
    let mut x = n;
    let mut y = (x + 1) / 2;
    
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    
    x
}
