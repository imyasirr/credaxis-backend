const mongoose = require("mongoose");

const userReferralSchema = new mongoose.Schema(
    {
        referrer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        referredUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        referralCode: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true,
        },

        status: {
            type: String,
            enum: ["REGISTERED", "ACTIVE"],
            default: "REGISTERED",
        },

        referrerRewardId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserReward",
            default: null,
        },

        refereeRewardId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserReward",
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

userReferralSchema.index({ referrer: 1, createdAt: -1 });

module.exports = mongoose.model("UserReferral", userReferralSchema);
