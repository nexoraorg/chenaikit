use crate::errors::CommonError;
use soroban_sdk::Env;

/// Time constants
pub const SECONDS_PER_MINUTE: u64 = 60;
pub const SECONDS_PER_HOUR: u64 = 3600;
pub const SECONDS_PER_DAY: u64 = 86400;
pub const SECONDS_PER_WEEK: u64 = 604800;
pub const SECONDS_PER_YEAR: u64 = 31536000; // 365 days

/// Time helper functions for Soroban contracts
pub struct TimeHelpers;

impl TimeHelpers {
    /// Get current ledger timestamp
    ///
    /// # Example
    /// ```
    /// let now = TimeHelpers::now(&env);
    /// ```
    pub fn now(env: &Env) -> u64 {
        env.ledger().timestamp()
    }

    /// Check if timestamp is in the past
    pub fn is_past(env: &Env, timestamp: u64) -> bool {
        Self::now(env) > timestamp
    }

    /// Check if timestamp is in the future
    pub fn is_future(env: &Env, timestamp: u64) -> bool {
        Self::now(env) < timestamp
    }

    /// Add duration to current time
    pub fn add_duration(env: &Env, seconds: u64) -> core::result::Result<u64, CommonError> {
        let now = Self::now(env);
        now.checked_add(seconds).ok_or(CommonError::Overflow)
    }

    /// Calculate time difference between two timestamps
    pub fn time_diff(later: u64, earlier: u64) -> core::result::Result<u64, CommonError> {
        if later < earlier {
            return Err(CommonError::InvalidTimestamp);
        }
        Ok(later - earlier)
    }

    /// Check if a duration has elapsed since a timestamp
    pub fn has_elapsed(
        env: &Env,
        since: u64,
        duration: u64,
    ) -> core::result::Result<bool, CommonError> {
        let now = Self::now(env);
        if now < since {
            return Err(CommonError::InvalidTimestamp);
        }
        Ok(now - since >= duration)
    }

    /// Get timestamp for N days from now
    pub fn days_from_now(env: &Env, days: u64) -> core::result::Result<u64, CommonError> {
        let seconds = days
            .checked_mul(SECONDS_PER_DAY)
            .ok_or(CommonError::Overflow)?;
        Self::add_duration(env, seconds)
    }

    /// Get timestamp for N hours from now
    pub fn hours_from_now(env: &Env, hours: u64) -> core::result::Result<u64, CommonError> {
        let seconds = hours
            .checked_mul(SECONDS_PER_HOUR)
            .ok_or(CommonError::Overflow)?;
        Self::add_duration(env, seconds)
    }

    /// Get timestamp for N minutes from now
    pub fn minutes_from_now(env: &Env, minutes: u64) -> core::result::Result<u64, CommonError> {
        let seconds = minutes
            .checked_mul(SECONDS_PER_MINUTE)
            .ok_or(CommonError::Overflow)?;
        Self::add_duration(env, seconds)
    }

    /// Check if current time is within a time window
    pub fn is_within_window(env: &Env, start: u64, end: u64) -> bool {
        let now = Self::now(env);
        now >= start && now <= end
    }

    /// Calculate age in seconds
    pub fn age(env: &Env, timestamp: u64) -> core::result::Result<u64, CommonError> {
        let now = Self::now(env);
        if now < timestamp {
            return Err(CommonError::InvalidTimestamp);
        }
        Ok(now - timestamp)
    }

    /// Convert days to seconds
    pub fn days_to_seconds(days: u64) -> core::result::Result<u64, CommonError> {
        days.checked_mul(SECONDS_PER_DAY)
            .ok_or(CommonError::Overflow)
    }

    /// Convert hours to seconds
    pub fn hours_to_seconds(hours: u64) -> core::result::Result<u64, CommonError> {
        hours
            .checked_mul(SECONDS_PER_HOUR)
            .ok_or(CommonError::Overflow)
    }

    /// Convert seconds to days (truncated)
    pub fn seconds_to_days(seconds: u64) -> u64 {
        seconds / SECONDS_PER_DAY
    }

    /// Convert seconds to hours (truncated)
    pub fn seconds_to_hours(seconds: u64) -> u64 {
        seconds / SECONDS_PER_HOUR
    }
}

/// Deadline management
pub struct Deadline {
    timestamp: u64,
}

impl Deadline {
    /// Create a new deadline
    pub fn new(timestamp: u64) -> Self {
        Self { timestamp }
    }

    /// Create deadline N seconds from now
    pub fn from_now(env: &Env, seconds: u64) -> core::result::Result<Self, CommonError> {
        let timestamp = TimeHelpers::add_duration(env, seconds)?;
        Ok(Self::new(timestamp))
    }

    /// Check if deadline has passed
    pub fn is_expired(&self, env: &Env) -> bool {
        TimeHelpers::is_past(env, self.timestamp)
    }

    /// Require deadline has not passed
    pub fn require_not_expired(&self, env: &Env) -> core::result::Result<(), CommonError> {
        if self.is_expired(env) {
            Err(CommonError::NotAllowed)
        } else {
            Ok(())
        }
    }

    /// Get remaining time until deadline
    pub fn remaining(&self, env: &Env) -> core::result::Result<u64, CommonError> {
        let now = TimeHelpers::now(env);
        if now >= self.timestamp {
            Ok(0)
        } else {
            Ok(self.timestamp - now)
        }
    }

    /// Get the deadline timestamp
    pub fn timestamp(&self) -> u64 {
        self.timestamp
    }
}
