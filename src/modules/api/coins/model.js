const mongoose = require("mongoose");

const coinWalletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },

        coinAccountNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        availableBalance: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalBalance: {
            type: Number,
            default: 0,
            min: 0,
        },

        lifetimeEarned: {
            type: Number,
            default: 0,
            min: 0,
        },

        lifetimeSpent: {
            type: Number,
            default: 0,
            min: 0,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "BLOCKED"],
            default: "ACTIVE",
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model("CoinWallet", coinWalletSchema);
