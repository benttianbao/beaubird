"use strict";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// Lanczos approximation with coefficients for g=7, n=9.
function logGamma(value) {
  const coefficients = [
    0.9999999999998099,
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  const z = value - 1;
  let sum = coefficients[0];
  for (let index = 1; index < coefficients.length; index += 1) {
    sum += coefficients[index] / (z + index);
  }
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

function betaContinuedFraction(a, b, x) {
  const maximumIterations = 200;
  const epsilon = 3e-14;
  const minimum = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < minimum) d = minimum;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const doubled = 2 * iteration;
    let aa = (iteration * (b - iteration) * x) / ((qam + doubled) * (a + doubled));
    d = 1 + aa * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + aa / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    result *= d * c;
    aa = (-(a + iteration) * (qab + iteration) * x) / ((a + doubled) * (qap + doubled));
    d = 1 + aa * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + aa / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return result;
}

function regularizedIncompleteBeta(x, a, b) {
  if (!(a > 0) || !(b > 0)) return Number.NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

function betaQuantile(probability, alpha, beta) {
  if (probability <= 0) return 0;
  if (probability >= 1) return 1;
  let lower = 0;
  let upper = 1;
  let middle = alpha / (alpha + beta);
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const cdf = regularizedIncompleteBeta(middle, alpha, beta);
    if (!Number.isFinite(cdf)) break;
    if (cdf < probability) lower = middle;
    else upper = middle;
    middle = (lower + upper) / 2;
    if (upper - lower < 1e-10) break;
  }
  return clamp(middle, 0, 1);
}

function betaInterval(alpha, beta, mass = 0.9) {
  const tail = (1 - mass) / 2;
  return {
    lower: betaQuantile(tail, alpha, beta),
    upper: betaQuantile(1 - tail, alpha, beta)
  };
}

function logistic(value) {
  if (value >= 0) {
    const inverse = Math.exp(-value);
    return 1 / (1 + inverse);
  }
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

function calibrateProbability(probability, parameters) {
  const p = clamp(Number(probability) || 0, 1e-9, 1 - 1e-9);
  if (!parameters) return p;
  const a = Number(parameters.a ?? 1);
  const b = Number(parameters.b ?? 1);
  const c = Number(parameters.c ?? 0);
  return logistic(a * Math.log(p) - b * Math.log(1 - p) + c);
}

function solveThreeByThree(matrix, vector) {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < 3; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    }
    if (Math.abs(augmented[best][pivot]) < 1e-12) return null;
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    for (let column = pivot; column < 4; column += 1) augmented[pivot][column] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column < 4; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }
  return augmented.map((row) => row[3]);
}

function fitBetaCalibration(points, options = {}) {
  const usable = (points || []).filter(
    (point) => Number(point.total) > 0 && Number.isFinite(Number(point.probability)) && Number(point.positives) >= 0
  );
  if (usable.length < 3) {
    return { a: 1, b: 1, c: 0, fitted: false, iterations: 0 };
  }
  const ridge = Number(options.ridge ?? 1e-3);
  const prior = [1, 1, 0];
  let coefficients = [...prior];
  let iterations = 0;
  for (; iterations < Number(options.maxIterations ?? 50); iterations += 1) {
    const gradient = [0, 0, 0];
    const information = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (const point of usable) {
      const p = clamp(Number(point.probability), 1e-8, 1 - 1e-8);
      const features = [Math.log(p), -Math.log(1 - p), 1];
      const total = Number(point.total);
      const positives = clamp(Number(point.positives), 0, total);
      const fitted = logistic(
        coefficients[0] * features[0] + coefficients[1] * features[1] + coefficients[2]
      );
      const residual = positives - total * fitted;
      const variance = Math.max(1e-9, total * fitted * (1 - fitted));
      for (let row = 0; row < 3; row += 1) {
        gradient[row] += features[row] * residual;
        for (let column = 0; column < 3; column += 1) {
          information[row][column] += features[row] * features[column] * variance;
        }
      }
    }
    for (let index = 0; index < 3; index += 1) {
      gradient[index] -= ridge * (coefficients[index] - prior[index]);
      information[index][index] += ridge;
    }
    const delta = solveThreeByThree(information, gradient);
    if (!delta) break;
    coefficients = coefficients.map((coefficient, index) => coefficient + clamp(delta[index], -2, 2));
    coefficients[0] = clamp(coefficients[0], 0.01, 10);
    coefficients[1] = clamp(coefficients[1], 0.01, 10);
    coefficients[2] = clamp(coefficients[2], -10, 10);
    if (Math.max(...delta.map(Math.abs)) < 1e-7) break;
  }
  return { a: coefficients[0], b: coefficients[1], c: coefficients[2], fitted: true, iterations };
}

function probabilityLevel(probability) {
  const value = Number(probability) || 0;
  if (value >= 0.5) return "very_high";
  if (value >= 0.25) return "high";
  if (value >= 0.1) return "medium";
  if (value >= 0.03) return "low";
  return "very_low";
}

function confidenceLevel(effectiveChecklists, observerCount, lower, upper) {
  const effective = Number(effectiveChecklists) || 0;
  const observers = Number(observerCount) || 0;
  const width = Math.max(0, Number(upper) - Number(lower));
  if (effective >= 100 && observers >= 15 && width <= 0.15) return "high";
  if (effective >= 30 && observers >= 5 && width <= 0.3) return "medium";
  return "low";
}

module.exports = {
  betaInterval,
  betaQuantile,
  calibrateProbability,
  clamp,
  confidenceLevel,
  fitBetaCalibration,
  logGamma,
  probabilityLevel,
  regularizedIncompleteBeta
};
