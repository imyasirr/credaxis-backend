const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    panNumber: String,

    aadhaarNumber: String,

    panImage: String,

    aadhaarFront: String,

    aadhaarBack: String,

    selfie: String,

    status: {
      type: String,
      enum: [
        "PENDING",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED"
      ],
      default: "PENDING",
    },

    remarks: String,

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: Date
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Kyc", kycSchema);