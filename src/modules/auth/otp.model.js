const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    mobile: {
      type: String,
      trim: true,
    },

    otp: {
      type: String,
      required: true,
    },

    purpose: {
      type: String,
      enum: [
        "REGISTER",
        "LOGIN",
        "EMAIL_VERIFY",
        "MOBILE_VERIFY",
        "FORGOT_PASSWORD",
        "TRANSACTION"
      ],
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    attempts: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);