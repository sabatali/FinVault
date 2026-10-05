import type {
  BalanceExpenseInput,
  BalanceMemberInput,
} from "@/lib/group-balances";
import { equalShares } from "@/lib/splits";

export interface ScenarioExpenseInput extends BalanceExpenseInput {
  expenseId: string;
  description: string;
  occurredAt: string;
  createdAt: string;
}

function atDay(day: number): { occurredAt: string; createdAt: string } {
  const occurredAt = new Date(Date.UTC(2026, 0, day, 12, 0, 0)).toISOString();
  const createdAt = new Date(Date.UTC(2026, 0, day, 12, 0, 1)).toISOString();
  return { occurredAt, createdAt };
}

export function equalExpense(input: {
  expenseId: string;
  description: string;
  amount: number;
  payerMemberId: string;
  participantIds: string[];
  day: number;
}): ScenarioExpenseInput {
  const shares = equalShares(input.amount, input.participantIds);
  const dates = atDay(input.day);
  return {
    expenseId: input.expenseId,
    description: input.description,
    payerMemberId: input.payerMemberId,
    amount: input.amount,
    participants: shares.map((share) => ({
      memberId: share.memberId,
      shareAmount: share.shareAmount,
    })),
    ...dates,
  };
}

export const SCENARIO_1_MEMBERS: BalanceMemberInput[] = [
  { memberId: "a", displayName: "A", memberType: "registered" },
  { memberId: "b", displayName: "B", memberType: "registered" },
  { memberId: "c", displayName: "C", memberType: "registered" },
];

const ABC = ["a", "b", "c"];

/** 10 × Rs 900 equal split. Nets: A +600, B −300, C −300. */
export function scenario1Expenses(): ScenarioExpenseInput[] {
  const payers = ["a", "b", "c", "b", "c", "a", "c", "a", "b", "a"] as const;
  return payers.map((payer, index) =>
    equalExpense({
      expenseId: `p${index + 1}`,
      description: `P${index + 1}`,
      amount: 900,
      payerMemberId: payer,
      participantIds: ABC,
      day: index + 1,
    }),
  );
}

export const SCENARIO_2_MEMBERS: BalanceMemberInput[] = [
  { memberId: "a", displayName: "A", memberType: "registered" },
  { memberId: "b", displayName: "B", memberType: "registered" },
  { memberId: "c", displayName: "C", memberType: "registered" },
  { memberId: "d", displayName: "D", memberType: "registered" },
];

/** 4-member trip. Nets ≈ A +275, B +58.33, C −991.67, D +658.33. */
export function scenario2Expenses(): ScenarioExpenseInput[] {
  return [
    equalExpense({
      expenseId: "p11",
      description: "Grocery",
      amount: 1200,
      payerMemberId: "a",
      participantIds: ["a", "b", "c", "d"],
      day: 11,
    }),
    equalExpense({
      expenseId: "p12",
      description: "Dinner",
      amount: 800,
      payerMemberId: "b",
      participantIds: ["b", "c", "d"],
      day: 12,
    }),
    equalExpense({
      expenseId: "p13",
      description: "Taxi",
      amount: 400,
      payerMemberId: "c",
      participantIds: ["a", "b"],
      day: 13,
    }),
    equalExpense({
      expenseId: "p14",
      description: "Hotel",
      amount: 2000,
      payerMemberId: "d",
      participantIds: ["a", "b", "c", "d"],
      day: 14,
    }),
    equalExpense({
      expenseId: "p15",
      description: "Snacks",
      amount: 300,
      payerMemberId: "a",
      participantIds: ["a", "c"],
      day: 15,
    }),
    equalExpense({
      expenseId: "p16",
      description: "Rental car",
      amount: 1600,
      payerMemberId: "b",
      participantIds: ["a", "b", "c", "d"],
      day: 16,
    }),
    equalExpense({
      expenseId: "p17",
      description: "Concert",
      amount: 1000,
      payerMemberId: "d",
      participantIds: ["b", "d"],
      day: 17,
    }),
    equalExpense({
      expenseId: "p18",
      description: "Fuel",
      amount: 500,
      payerMemberId: "c",
      participantIds: ["a", "b", "c", "d"],
      day: 18,
    }),
    equalExpense({
      expenseId: "p19",
      description: "Tour guide",
      amount: 600,
      payerMemberId: "a",
      participantIds: ["a", "b", "c", "d"],
      day: 19,
    }),
    equalExpense({
      expenseId: "p20",
      description: "Breakfast",
      amount: 200,
      payerMemberId: "b",
      participantIds: ["b", "d"],
      day: 20,
    }),
  ];
}
