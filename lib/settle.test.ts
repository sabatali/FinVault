import { describe, expect, it } from "vitest";

import {
  applySuggestionsToNets,
  suggestTransfers,
  suggestionsClearAllNets,
} from "@/lib/settle";
import { toPaisa } from "@/lib/splits";

describe("suggestTransfers", () => {
  it("returns empty when everyone is settled", () => {
    const nets = [
      { memberId: "a", net: 0 },
      { memberId: "b", net: 0 },
    ];
    expect(suggestTransfers(nets)).toEqual([]);
  });

  it("returns empty for a single member", () => {
    expect(suggestTransfers([{ memberId: "a", net: 0 }])).toEqual([]);
  });

  it("clears a 3-person equal dinner (one payer)", () => {
    const nets = [
      { memberId: "a", net: 2000 },
      { memberId: "b", net: -1000 },
      { memberId: "c", net: -1000 },
    ];
    const suggestions = suggestTransfers(nets);
    expect(suggestions).toHaveLength(2);
    expect(suggestionsClearAllNets(nets, suggestions)).toBe(true);

    const after = applySuggestionsToNets(nets, suggestions);
    for (const row of after) {
      expect(toPaisa(row.net)).toBe(0);
    }
  });

  it("handles one debtor and multiple creditors", () => {
    const nets = [
      { memberId: "debtor", net: -1500 },
      { memberId: "c1", net: 1000 },
      { memberId: "c2", net: 500 },
    ];
    const suggestions = suggestTransfers(nets);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((row) => row.fromMemberId === "debtor")).toBe(
      true,
    );
    expect(suggestionsClearAllNets(nets, suggestions)).toBe(true);
  });

  it("skips dust below one paisa", () => {
    const nets = [
      { memberId: "a", net: 0.004 },
      { memberId: "b", net: -0.004 },
    ];
    expect(suggestTransfers(nets)).toEqual([]);
  });

  it("includes guests as from/to", () => {
    const nets = [
      { memberId: "guest", net: -500 },
      { memberId: "reg", net: 500 },
    ];
    const suggestions = suggestTransfers(nets);
    expect(suggestions).toEqual([
      { fromMemberId: "guest", toMemberId: "reg", amount: 500 },
    ]);
    expect(suggestionsClearAllNets(nets, suggestions)).toBe(true);
  });
});
