import { afterEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

import { TransactionsUnavailableError } from "@/lib/ledger-errors";
import { withTransaction } from "@/lib/with-transaction";

describe("withTransaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws TransactionsUnavailableError when the deployment is not a replica set", async () => {
    vi.spyOn(mongoose, "startSession").mockResolvedValue({
      withTransaction: async () => {
        throw new Error(
          "Transaction numbers are only allowed on a replica set member",
        );
      },
      endSession: async () => undefined,
    } as unknown as mongoose.ClientSession);

    await expect(
      withTransaction(async () => "ok"),
    ).rejects.toBeInstanceOf(TransactionsUnavailableError);

    await expect(withTransaction(async () => "ok")).rejects.toMatchObject({
      status: 503,
      code: "TRANSACTIONS_UNAVAILABLE",
    });
  });

  it("does not fall back when a replica-set error is thrown", async () => {
    const fallback = vi.fn();
    vi.spyOn(mongoose, "startSession").mockResolvedValue({
      withTransaction: async () => {
        throw new Error("Transaction numbers are only allowed on a replica set member");
      },
      endSession: async () => undefined,
    } as unknown as mongoose.ClientSession);

    await expect(
      withTransaction(async () => {
        fallback();
        return "ok";
      }),
    ).rejects.toBeInstanceOf(TransactionsUnavailableError);
    expect(fallback).not.toHaveBeenCalled();
  });
});
