import mongoose, { Schema, type Document, type Model } from "mongoose";

export const GROUP_EXPENSE_SPLIT_TYPES = ["equal", "manual"] as const;
export type GroupExpenseSplitType = (typeof GROUP_EXPENSE_SPLIT_TYPES)[number];

export interface IGroupExpenseParticipant {
  member: mongoose.Types.ObjectId;
  shareAmount: number;
}

export interface IGroupExpense extends Document {
  group: mongoose.Types.ObjectId;
  description: string;
  amount: number;
  currency: string;
  splitType: GroupExpenseSplitType;
  payerMember: mongoose.Types.ObjectId;
  payerAccount: mongoose.Types.ObjectId | null;
  participants: IGroupExpenseParticipant[];
  occurredAt: Date;
  createdBy: mongoose.Types.ObjectId;
  transactionId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const groupExpenseParticipantSchema = new Schema<IGroupExpenseParticipant>(
  {
    member: {
      type: Schema.Types.ObjectId,
      ref: "GroupMember",
      required: true,
    },
    shareAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const groupExpenseSchema = new Schema<IGroupExpense>(
  {
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "PKR",
      uppercase: true,
      match: /^[A-Z]{3}$/,
    },
    splitType: {
      type: String,
      required: true,
      enum: GROUP_EXPENSE_SPLIT_TYPES,
    },
    payerMember: {
      type: Schema.Types.ObjectId,
      ref: "GroupMember",
      required: true,
    },
    payerAccount: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    participants: {
      type: [groupExpenseParticipantSchema],
      required: true,
      validate: {
        validator: (value: IGroupExpenseParticipant[]) => value.length >= 1,
        message: "At least one participant is required",
      },
    },
    occurredAt: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

groupExpenseSchema.index({ group: 1, occurredAt: -1 });

export interface GroupExpenseParticipantPublic {
  memberId: string;
  displayName?: string;
  shareAmount: number;
}

export interface GroupExpensePublic {
  id: string;
  group: string;
  description: string;
  amount: number;
  currency: string;
  splitType: GroupExpenseSplitType;
  payerMemberId: string;
  payerDisplayName?: string;
  payerAccountId: string | null;
  payerAccountName?: string;
  participants: GroupExpenseParticipantPublic[];
  occurredAt: string;
  createdBy: string;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toGroupExpensePublic(
  expense: IGroupExpense,
  extras?: {
    payerDisplayName?: string;
    payerAccountName?: string;
    participantNames?: Record<string, string>;
  },
): GroupExpensePublic {
  return {
    id: expense._id.toString(),
    group: expense.group.toString(),
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    splitType: expense.splitType,
    payerMemberId: expense.payerMember.toString(),
    ...(extras?.payerDisplayName !== undefined
      ? { payerDisplayName: extras.payerDisplayName }
      : {}),
    payerAccountId: expense.payerAccount
      ? expense.payerAccount.toString()
      : null,
    ...(extras?.payerAccountName !== undefined
      ? { payerAccountName: extras.payerAccountName }
      : {}),
    participants: expense.participants.map((participant) => {
      const memberId = participant.member.toString();
      return {
        memberId,
        ...(extras?.participantNames?.[memberId]
          ? { displayName: extras.participantNames[memberId] }
          : {}),
        shareAmount: participant.shareAmount,
      };
    }),
    occurredAt: expense.occurredAt.toISOString(),
    createdBy: expense.createdBy.toString(),
    transactionId: expense.transactionId
      ? expense.transactionId.toString()
      : null,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export const GroupExpense: Model<IGroupExpense> =
  (mongoose.models.GroupExpense as Model<IGroupExpense> | undefined) ??
  mongoose.model<IGroupExpense>("GroupExpense", groupExpenseSchema);
