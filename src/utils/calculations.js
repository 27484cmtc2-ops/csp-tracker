export function normCDF(x) {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1 / (1 + p * x);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

export function bsPut(S, K, T, r, sigma) {
  const d1 =
    (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  return (
    K * Math.exp(-r * T) * normCDF(-d2) -
    S * normCDF(-d1)
  );
}

export function getDelta(S, K, T, r, sigma) {
  const d1 =
    (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));

  return Math.abs(normCDF(-d1));
}

export function generateStrikes(ticker, targetUSD) {
  const S = ticker.price;
  const sigma = ticker.iv / 100;
  const T = 30 / 365;
  const r = 0.05;

  return [0.97, 0.95, 0.92, 0.9, 0.85].map((percentage) => {
    const strike = Math.round(S * percentage);
    const premium = bsPut(S, strike, T, r, sigma);
    const delta = getDelta(S, strike, T, r, sigma);
    const contracts = premium > 0
      ? Math.ceil(targetUSD / (premium * 100))
      : null;

    return {
      strike,
      otmPct: Math.round((1 - strike / S) * 100),
      premium,
      delta,
      contracts,
      collateral: contracts ? strike * 100 * contracts : null,
      premiumTotal: contracts ? premium * 100 * contracts : 0,
    };
  });
}
