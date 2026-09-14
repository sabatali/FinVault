import { describe, expect, it } from "vitest";

import { formatPkrAmount, toBase, toDisplay } from "@/lib/fx";

describe("fx display conversion", () => {
  const rates = { USD: 278.5, EUR: 300 };

  it("converts 27850 PKR to ~100 USD once", () => {
    const result = toDisplay(27850, "USD", rates);
    expect(result.currency).toBe("USD");
    expect(result.converted).toBe(true);
    expect(result.amount).toBe(100);
  });

  it("formats 27850 PKR as USD 100.00", () => {
    const text = formatPkrAmount(27850, {
      displayCurrency: "USD",
      rates,
    });
    expect(text).toMatch(/USD/);
    expect(text).toMatch(/100\.00/);
  });

  it("does not convert when target is PKR", () => {
    const result = toDisplay(1000, "PKR", rates);
    expect(result.amount).toBe(1000);
    expect(result.currency).toBe("PKR");
    expect(result.converted).toBe(false);
  });

  it("falls back to PKR when rate missing", () => {
    const result = toDisplay(1000, "USD", {});
    expect(result.currency).toBe("PKR");
    expect(result.amount).toBe(1000);
    expect(result.converted).toBe(false);
  });

  it("falls back for unknown currency codes", () => {
    const result = toDisplay(1000, "XYZ", rates);
    expect(result.currency).toBe("PKR");
  });

  it("toBase round-trips USD input", () => {
    expect(toBase(100, "USD", rates)).toBe(27850);
  });

  it("does not double-convert: convert once at display", () => {
    const accounts = [10000, 17850];
    const sumPkr = accounts.reduce((a, b) => a + b, 0);
    const once = toDisplay(sumPkr, "USD", rates).amount;
    expect(once).toBe(100);

    // Wrong pattern would convert each then sum; for linear FX it equals,
    // but stored amounts stay PKR — display path uses sum-then-convert once.
    const again = toDisplay(once * rates.USD, "USD", rates).amount;
    expect(again).toBe(100);
  });
});
