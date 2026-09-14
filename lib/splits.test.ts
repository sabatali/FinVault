import { describe, expect, it } from "vitest";

import {
  assertSharesSumToTotal,
  equalShares,
  SharesSumError,
  sharesRemaining,
  sumShareAmounts,
} from "@/lib/splits";
import { roundAmount } from "@/lib/money";

describe("splits", () => {
  it("equalShares always sum to the total", () => {
    const shares = equalShares(100, ["a", "b", "c"]);
    expect(sumShareAmounts(shares)).toBe(100);
    expect(shares.map((s) => s.shareAmount).sort()).toEqual([
      33.33, 33.33, 33.34,
    ]);
  });

  it("rejects manual shares off by 0.01", () => {
    expect(() =>
      assertSharesSumToTotal(100, [
        { memberId: "a", amount: 50 },
        { memberId: "b", amount: 49.99 },
      ]),
    ).toThrow(SharesSumError);
  });

  it("accepts manual shares that sum exactly", () => {
    const shares = assertSharesSumToTotal(100, [
      { memberId: "a", amount: 40 },
      { memberId: "b", amount: 60 },
    ]);
    expect(sumShareAmounts(shares)).toBe(100);
  });

  it("sharesRemaining shows leftover for incomplete manual entry", () => {
    expect(roundAmount(sharesRemaining(100, [40, 50]))).toBe(10);
  });
});
