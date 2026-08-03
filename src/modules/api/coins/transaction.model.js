const mongoose = require("mongoose");

const coinTransactionSchema = new mongoose.Schema(
    {
        coinWallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CoinWallet",
            required: true,
            index: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        transactionId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        referenceId: {
            type: String,
            default: null,
            trim: true,
        },

        transactionType: {
            type: String,
            enum: ["CREDIT", "DEBIT", "REVERSAL"],
            required: true,
        },

        source: {
            type: String,
            enum: ["REWARD", "ADMIN", "TRANSFER", "GAME", "OTHER"],
            default: "OTHER",
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        openingBalance: {
            type: Number,
            required: true,
            min: 0,
        },

        closingBalance: {
            type: Number,
            required: true,
            min: 0,
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        status: {
            type: String,
            enum: ["SUCCESS", "FAILED", "PENDING"],
            default: "SUCCESS",
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

coinTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("CoinTransaction", coinTransactionSchema);
