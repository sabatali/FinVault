import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  preferredCurrency: string;
  /** Guest GroupMember ids the user marked "Not me" (sticky dismiss). */
  dismissedGuestMemberIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    preferredCurrency: {
      type: String,
      default: "PKR",
      uppercase: true,
      match: /^[A-Z]{3}$/,
    },
    dismissedGuestMemberIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "GroupMember" }],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  preferredCurrency: string;
}

export function toUserPublic(user: IUser): UserPublic {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    preferredCurrency: user.preferredCurrency,
  };
}

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser> | undefined) ??
  mongoose.model<IUser>("User", userSchema);
