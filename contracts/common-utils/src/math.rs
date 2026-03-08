use crate::errors::CommonError;

/// Safe arithmetic operations with overflow/underflow protection
pub struct SafeMath;

impl SafeMath {
    /// Safe addition with overflow check
    ///
    /// # Example
    /// ```
    /// let result = SafeMath::add(100, 50)?; // Returns Ok(150)
    /// ```
    pub fn add(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        a.checked_add(b).ok_or(CommonError::Overflow)
    }

    /// Safe subtraction with underflow check
    pub fn sub(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        a.checked_sub(b).ok_or(CommonError::Underflow)
    }

    /// Safe multiplication with overflow check
    pub fn mul(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        a.checked_mul(b).ok_or(CommonError::Overflow)
    }

    /// Safe division with zero check
    pub fn div(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        if b == 0 {
            return Err(CommonError::DivisionByZero);
        }
        a.checked_div(b).ok_or(CommonError::Overflow)
    }

    /// Safe modulo operation
    pub fn modulo(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        if b == 0 {
            return Err(CommonError::DivisionByZero);
        }
        Ok(a % b)
    }

    /// Calculate absolute value
    pub fn abs(a: i128) -> core::result::Result<i128, CommonError> {
        a.checked_abs().ok_or(CommonError::Overflow)
    }

    /// Get minimum of two values
    pub fn min(a: i128, b: i128) -> i128 {
        if a < b {
            a
        } else {
            b
        }
    }

    /// Get maximum of two values
    pub fn max(a: i128, b: i128) -> i128 {
        if a > b {
            a
        } else {
            b
        }
    }

    /// Clamp value between min and max
    pub fn clamp(value: i128, min: i128, max: i128) -> i128 {
        if value < min {
            min
        } else if value > max {
            max
        } else {
            value
        }
    }
}

/// Percentage calculations with precision
pub struct Percentage;

impl Percentage {
    const PRECISION: i128 = 10000; // 0.01% precision (basis points)

    /// Calculate percentage of a value
    ///
    /// # Arguments
    /// * `value` - The base value
    /// * `percentage` - Percentage in basis points (100 = 1%, 10000 = 100%)
    ///
    /// # Example
    /// ```
    /// let result = Percentage::of(1000, 500)?; // 5% of 1000 = 50
    /// ```
    pub fn of(value: i128, percentage: i128) -> core::result::Result<i128, CommonError> {
        let result = SafeMath::mul(value, percentage)?;
        SafeMath::div(result, Self::PRECISION)
    }

    /// Calculate what percentage one value is of another
    /// Returns result in basis points
    pub fn calculate(part: i128, whole: i128) -> core::result::Result<i128, CommonError> {
        if whole == 0 {
            return Err(CommonError::DivisionByZero);
        }
        let scaled = SafeMath::mul(part, Self::PRECISION)?;
        SafeMath::div(scaled, whole)
    }

    /// Add percentage to a value
    pub fn add(value: i128, percentage: i128) -> core::result::Result<i128, CommonError> {
        let increase = Self::of(value, percentage)?;
        SafeMath::add(value, increase)
    }

    /// Subtract percentage from a value
    pub fn sub(value: i128, percentage: i128) -> core::result::Result<i128, CommonError> {
        let decrease = Self::of(value, percentage)?;
        SafeMath::sub(value, decrease)
    }
}

/// Fixed-point arithmetic for financial calculations
/// Uses 7 decimal places of precision
pub struct FixedPoint;

impl FixedPoint {
    const DECIMALS: i128 = 10_000_000; // 7 decimal places

    /// Convert integer to fixed-point
    pub fn from_int(value: i128) -> core::result::Result<i128, CommonError> {
        SafeMath::mul(value, Self::DECIMALS)
    }

    /// Convert fixed-point to integer (truncates decimals)
    pub fn to_int(value: i128) -> i128 {
        value / Self::DECIMALS
    }

    /// Multiply two fixed-point numbers
    pub fn mul(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        let result = SafeMath::mul(a, b)?;
        SafeMath::div(result, Self::DECIMALS)
    }

    /// Divide two fixed-point numbers
    pub fn div(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        if b == 0 {
            return Err(CommonError::DivisionByZero);
        }
        let scaled = SafeMath::mul(a, Self::DECIMALS)?;
        SafeMath::div(scaled, b)
    }

    /// Add two fixed-point numbers
    pub fn add(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        SafeMath::add(a, b)
    }

    /// Subtract two fixed-point numbers
    pub fn sub(a: i128, b: i128) -> core::result::Result<i128, CommonError> {
        SafeMath::sub(a, b)
    }

    /// Round fixed-point number to nearest integer
    pub fn round(value: i128) -> i128 {
        let half = Self::DECIMALS / 2;
        if value >= 0 {
            (value + half) / Self::DECIMALS
        } else {
            (value - half) / Self::DECIMALS
        }
    }

    /// Get fractional part of fixed-point number
    pub fn frac(value: i128) -> i128 {
        value % Self::DECIMALS
    }
}

/// Weighted average calculation
pub fn weighted_average(
    values: &[i128],
    weights: &[i128],
) -> core::result::Result<i128, CommonError> {
    if values.len() != weights.len() {
        return Err(CommonError::InvalidInput);
    }
    if values.is_empty() {
        return Err(CommonError::InvalidInput);
    }

    let mut sum = 0i128;
    let mut weight_sum = 0i128;

    for i in 0..values.len() {
        let weighted = SafeMath::mul(values[i], weights[i])?;
        sum = SafeMath::add(sum, weighted)?;
        weight_sum = SafeMath::add(weight_sum, weights[i])?;
    }

    if weight_sum == 0 {
        return Err(CommonError::DivisionByZero);
    }

    SafeMath::div(sum, weight_sum)
}

/// Calculate compound interest
///
/// # Arguments
/// * `principal` - Initial amount
/// * `rate` - Interest rate in basis points per period
/// * `periods` - Number of compounding periods
pub fn compound_interest(
    principal: i128,
    rate: i128,
    periods: u32,
) -> core::result::Result<i128, CommonError> {
    let mut amount = principal;

    for _ in 0..periods {
        let interest = Percentage::of(amount, rate)?;
        amount = SafeMath::add(amount, interest)?;
    }

    Ok(amount)
}
