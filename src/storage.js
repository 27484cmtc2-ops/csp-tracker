export function loadData(defaultTrades) {
  try {
    const t = localStorage.getItem("csp_trades");
    const tgt = localStorage.getItem("csp_target");

    return {
      trades: t ? JSON.parse(t) : defaultTrades,
      target: tgt ? parseFloat(tgt) : 500,
    };
  } catch {
    return {
      trades: defaultTrades,
      target: 500,
    };
  }
}

export function saveData(trades, target) {
  try {
    localStorage.setItem("csp_trades", JSON.stringify(trades));
    localStorage.setItem("csp_target", String(target));
  } catch {}
}