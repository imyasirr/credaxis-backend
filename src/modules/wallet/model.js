const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },

        walletNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        currency: {
            type: String,
            default: "INR",
        },

        availableBalance: {
            type: Number,
            default: 0,
            min: 0,
        },

        holdBalance: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalBalance: {
            type: Number,
            default: 0,
            min: 0,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "BLOCKED"],
            default: "ACTIVE",
        },

        isKycCompleted: {
            type: Boolean,
            default: false,
        },

        dailyLimit: {
            type: Number,
            default: 100000,
        },

        monthlyLimit: {
            type: Number,
            default: 1000000,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model("Wallet", walletSchema);