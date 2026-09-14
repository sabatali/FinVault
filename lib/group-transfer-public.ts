import { connectDB } from "@/lib/db";
import { Account } from "@/models/Account";
import { GroupMember } from "@/models/GroupMember";
import {
  toGroupTransferPublic,
  type GroupTransferPublic,
  type IGroupTransfer,
} from "@/models/GroupTransfer";

export async function buildGroupTransferPublic(
  transfer: IGroupTransfer,
): Promise<GroupTransferPublic> {
  await connectDB();

  const [fromMember, toMember] = await Promise.all([
    GroupMember.findById(transfer.fromMember).select("displayName"),
    GroupMember.findById(transfer.toMember).select("displayName"),
  ]);

  const accountIds = [transfer.fromAccount, transfer.toAccount].filter(
    (id): id is NonNullable<typeof id> => Boolean(id),
  );
  const accounts =
    accountIds.length > 0
      ? await Account.find({ _id: { $in: accountIds } }).select(
          "name cachedBalance",
        )
      : [];
  const accountById = new Map(
    accounts.map((account) => [account._id.toString(), account]),
  );

  const fromAccount = transfer.fromAccount
    ? accountById.get(transfer.fromAccount.toString())
    : undefined;

  return toGroupTransferPublic(transfer, {
    fromDisplayName: fromMember?.displayName,
    toDisplayName: toMember?.displayName,
    fromAccountName: fromAccount?.name,
    toAccountName: transfer.toAccount
      ? accountById.get(transfer.toAccount.toString())?.name
      : undefined,
    senderWouldGoNegative:
      fromAccount !== undefined
        ? fromAccount.cachedBalance < transfer.amount
        : undefined,
  });
}
