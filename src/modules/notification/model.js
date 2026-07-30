const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "INFO",
        "SUCCESS",
        "WARNING",
        "ERROR",
        "REWARD",
      ],
      default: "INFO",
    },

    /** Optional override; if empty, mapper derives from `type` */
    icon: {
      type: String,
      trim: true,
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);