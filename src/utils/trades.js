export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${dateStr}T00:00:00`);
  return Math.round((expiry - today) / 86400000);
}

export function daysColor(days) {
  if (days == null) return "#7f8ea3";
  if (days <= 3) return "#ff6a6a";
  if (days <= 10) return "#f59e0b";
  return "#6a9a6a";
}

export function daysLabel(days) {
  if (days == null) return "—";
  if (days < 0) return "EXPIRED";
  if (days === 0) return "TODAY";
  return `${days}d`;
}

export function daysBetween(start, end) {
  if (!start || !end) return null;
  const first = new Date(`${start}T00:00:00`);
  const second = new Date(`${end}T00:00:00`);
  return Math.round((second - first) / 86400000);
}

export function getCollateral(trade) {
  if (trade.longStrike != null) {
    return Math.abs(trade.strike - trade.longStrike) * 100 * trade.contracts;
  }
  return trade.strike * 100 * trade.contracts;
}

export function getCollectedPremium(trade) {
  return trade.creditTotal ?? trade.premium * trade.contracts * 100;
}

export function getDisplayedOpenPremium(trade) {
  return trade.rolledFromId && trade.rollNet != null
    ? trade.rollNet
    : getCollectedPremium(trade);
}

export function annualizedReturn(trade) {
  const collateral = getCollateral(trade);
  if (!collateral) return null;
  const duration = daysBetween(trade.opened, trade.expiry);
  if (!duration || duration <= 0) return null;
  return (getCollectedPremium(trade) / collateral) * (365 / duration) * 100;
}
