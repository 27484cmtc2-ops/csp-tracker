export function validateNewTradeExpiry(expiry) {
  if (!expiry) return "Choose an expiry date.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return "Enter a valid expiry date.";

  const parsed = new Date(`${expiry}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== expiry) {
    return "Enter a valid expiry date.";
  }

  return null;
}
