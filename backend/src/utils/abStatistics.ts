/**
 * Statistical helpers for A/B test analysis.
 *
 * Implements a two-proportion z-test, which is the standard approach for
 * conversion-rate experiments (exposures -> conversions per variant).
 */

export interface VariantSample {
  name: string;
  exposures: number;
  conversions: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number;
}

export interface SignificanceResult {
  pValue: number;
  zScore: number;
  significant: boolean;
  alpha: number;
  controlRate: number;
  variantRate: number;
  relativeUplift: number;
  confidenceInterval: ConfidenceInterval;
}

export interface PowerAnalysisResult {
  requiredSampleSizePerVariant: number;
  minimumDetectableEffect: number;
  baselineRate: number;
  power: number;
  alpha: number;
}

// Standard normal CDF via Abramowitz & Stegun approximation (accurate to ~1e-7).
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) prob = 1 - prob;
  return prob;
}

// Inverse standard normal CDF (Beasley-Springer-Moro algorithm).
export function inverseNormalCdf(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error('p must be in the open interval (0, 1)');
  }

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

/**
 * Applies a Bonferroni correction to the significance level to control the
 * family-wise error rate when comparing more than two variants.
 */
export function bonferroniCorrectedAlpha(alpha: number, numComparisons: number): number {
  if (numComparisons < 1) {
    throw new Error('numComparisons must be >= 1');
  }
  return alpha / numComparisons;
}

/**
 * Two-proportion z-test comparing a control and a treatment variant.
 */
export function checkSignificance(
  control: VariantSample,
  variant: VariantSample,
  alpha: number = 0.05
): SignificanceResult {
  if (control.exposures <= 0 || variant.exposures <= 0) {
    throw new Error('Both variants must have at least one exposure');
  }

  const p1 = control.conversions / control.exposures;
  const p2 = variant.conversions / variant.exposures;
  const pooled =
    (control.conversions + variant.conversions) /
    (control.exposures + variant.exposures);

  const se = Math.sqrt(
    pooled * (1 - pooled) * (1 / control.exposures + 1 / variant.exposures)
  );

  const zScore = se === 0 ? 0 : (p2 - p1) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));

  const relativeUplift = p1 === 0 ? 0 : (p2 - p1) / p1;

  return {
    pValue,
    zScore,
    significant: pValue < alpha,
    alpha,
    controlRate: p1,
    variantRate: p2,
    relativeUplift,
    confidenceInterval: computeConfidenceInterval(control, variant, 1 - alpha),
  };
}

/**
 * Confidence interval for the difference in conversion rate (variant - control).
 */
export function computeConfidenceInterval(
  control: VariantSample,
  variant: VariantSample,
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  if (control.exposures <= 0 || variant.exposures <= 0) {
    throw new Error('Both variants must have at least one exposure');
  }

  const p1 = control.conversions / control.exposures;
  const p2 = variant.conversions / variant.exposures;

  const se = Math.sqrt(
    (p1 * (1 - p1)) / control.exposures + (p2 * (1 - p2)) / variant.exposures
  );

  const z = inverseNormalCdf(1 - (1 - confidenceLevel) / 2);
  const diff = p2 - p1;

  return {
    lower: diff - z * se,
    upper: diff + z * se,
    confidenceLevel,
  };
}

/**
 * Required sample size per variant to detect `minimumDetectableEffect`
 * (relative uplift) at the given significance level and power.
 */
export function calculateMinimumSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  alpha: number = 0.05,
  power: number = 0.8
): PowerAnalysisResult {
  if (baselineRate <= 0 || baselineRate >= 1) {
    throw new Error('baselineRate must be in the open interval (0, 1)');
  }
  if (minimumDetectableEffect <= 0) {
    throw new Error('minimumDetectableEffect must be > 0');
  }

  const p1 = baselineRate;
  const p2 = baselineRate * (1 + minimumDetectableEffect);

  const zAlpha = inverseNormalCdf(1 - alpha / 2);
  const zBeta = inverseNormalCdf(power);

  const pooled = (p1 + p2) / 2;
  const term1 = zAlpha * Math.sqrt(2 * pooled * (1 - pooled));
  const term2 = zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));

  const n = Math.pow(term1 + term2, 2) / Math.pow(p2 - p1, 2);

  return {
    requiredSampleSizePerVariant: Math.ceil(n),
    minimumDetectableEffect,
    baselineRate,
    power,
    alpha,
  };
}

/**
 * Peek-prevention guard for early stopping: an experiment should only be
 * evaluated for a stopping decision once it has collected the minimum sample
 * size per variant computed via power analysis. Calling checkSignificance
 * before that point risks inflated false-positive rates ("p-hacking").
 */
export function hasReachedMinimumSampleSize(
  sample: VariantSample,
  requiredSampleSizePerVariant: number
): boolean {
  return sample.exposures >= requiredSampleSizePerVariant;
}
