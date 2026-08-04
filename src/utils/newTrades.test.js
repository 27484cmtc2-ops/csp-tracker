import { validateNewTradeExpiry } from "./newTrades";

test("requires an expiry for every new option trade", () => {
  expect(validateNewTradeExpiry("")).toBe("Choose an expiry date.");
});

test.each(["not-a-date", "2026-02-30", "2026-13-01"])(
  "rejects invalid expiry %s",
  (expiry) => {
    expect(validateNewTradeExpiry(expiry)).toBe("Enter a valid expiry date.");
  }
);

test("accepts a real ISO expiry date", () => {
  expect(validateNewTradeExpiry("2026-09-18")).toBeNull();
});
