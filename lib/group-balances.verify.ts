/**
 * Table-driven checks for aggregateGroupBalances (run via:
 * npx tsx --tsconfig tsconfig.json lib/group-balances.verify.ts
 * when tsx is available; also covered by Phase 8.4 Vitest).
 */
import { aggregateGroupBalances } from "@/lib/group-balances";
import { toPaisa } from "@/lib/splits";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const members = [
  { memberId: "a", displayName: "Ayesha", memberType: "registered" as const },
  { memberId: "b", displayName: "Ali", memberType: "registered" as const },
  { memberId: "c", displayName: "Guest", memberType: "guest" as const },
];

const equal3000 = aggregateGroupBalances({
  members,
  expenses: [
    {
      payerMemberId: "a",
      amount: 3000,
      participants: [
        { memberId: "a", shareAmount: 1000 },
        { memberId: "b", shareAmount: 1000 },
        { memberId: "c", shareAmount: 1000 },
      ],
    },
  ],
});

assert(toPaisa(equal3000.sumOfNets) === 0, "sumOfNets must be 0");
assert(
  equal3000.members.find((m) => m.memberId === "a")?.net === 2000,
  "payer net +2000",
);
assert(
  equal3000.members.find((m) => m.memberId === "b")?.net === -1000,
  "Ali owes 1000",
);
assert(
  equal3000.members.find((m) => m.memberId === "c")?.net === -1000,
  "guest owes 1000",
);

const empty = aggregateGroupBalances({ members, expenses: [] });
assert(
  empty.members.every((m) => m.net === 0),
  "no expenses => all settled",
);

const withTransfer = aggregateGroupBalances({
  members,
  expenses: [
    {
      payerMemberId: "a",
      amount: 3000,
      participants: [
        { memberId: "a", shareAmount: 1000 },
        { memberId: "b", shareAmount: 1000 },
        { memberId: "c", shareAmount: 1000 },
      ],
    },
  ],
  transfers: [{ fromMemberId: "b", toMemberId: "a", amount: 1000 }],
});

assert(toPaisa(withTransfer.sumOfNets) === 0, "transfer keeps sum 0");
assert(
  withTransfer.members.find((m) => m.memberId === "b")?.net === 0,
  "Ali settled after paying Ayesha",
);
assert(
  withTransfer.members.find((m) => m.memberId === "a")?.net === 1000,
  "Ayesha still owed 1000 by guest",
);

console.info("group-balances verify: ok");
