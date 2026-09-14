import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IGroup extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export interface GroupPublic {
  id: string;
  name: string;
  createdBy: string;
  role?: "admin" | "member";
  createdAt: string;
  updatedAt: string;
}

export function toGroupPublic(
  group: IGroup,
  extras?: { role?: "admin" | "member" },
): GroupPublic {
  return {
    id: group._id.toString(),
    name: group.name,
    createdBy: group.createdBy.toString(),
    ...(extras?.role !== undefined ? { role: extras.role } : {}),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export const Group: Model<IGroup> =
  (mongoose.models.Group as Model<IGroup> | undefined) ??
  mongoose.model<IGroup>("Group", groupSchema);
