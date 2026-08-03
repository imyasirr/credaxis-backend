const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    accessToken: String,

    refreshToken: String,

    deviceName: String,

    browser: String,

    os: String,

    ipAddress: String,

    loginAt: {
      type: Date,
      default: Date.now,
    },

    logoutAt: Date,

    isActive: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Session", sessionSchema);