const mongoose = require("mongoose");

const bankAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },

    bankName: {
      type: String,
      required: true,
    },

    accountNumber: {
      type: String,
      required: true,
    },

    ifscCode: {
      type: String,
      required: true,
      uppercase: true,
    },

    branchName: {
      type: String,
    },

    accountType: {
      type: String,
      enum: ["SAVING", "CURRENT"],
      default: "SAVING",
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model(
  "BankAccount",
  bankAccountSchema
);