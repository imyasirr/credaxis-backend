const mongoose = require("mongoose");

const userRewardSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        gameType: {
            type: String,
            enum: ["WHEEL", "SCRATCH", "SHUFFLE"],
            required: true,
            index: true,
        },

        prizeId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        prizeTitle: {
            type: String,
            required: true,
            trim: true,
        },

        prizeType: {
            type: String,
            enum: ["CASH", "TOKEN", "COUPON", "NO_PRIZE"],
            required: true,
            index: true,
        },

        value: {
            type: Number,
            default: 0,
            min: 0,
        },

        color: {
            type: String,
            trim: true,
            default: "#6366f1",
        },

        expiryDays: {
            type: Number,
            default: 0,
            min: 0,
        },

        status: {
            type: String,
            enum: ["PENDING", "CLAIMED", "EXPIRED", "CANCELLED"],
            default: "PENDING",
            index: true,
        },

        wonAt: {
            type: Date,
            default: Date.now,
            index: true,
        },

        expiresAt: {
            type: Date,
            default: null,
            index: true,
        },

        claimedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

userRewardSchema.index({ user: 1, createdAt: -1 });
userRewardSchema.index({ user: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model("UserReward", userRewardSchema);
