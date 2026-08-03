const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
    {
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true,
            index: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        transactionId: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
        },

        referenceId: {
            type: String,
            default: null,
        },

        transactionType: {
            type: String,
            enum: [
                "CREDIT",
                "DEBIT",
                "TRANSFER",
                "REFUND",
                "REVERSAL",
            ],
            required: true,
        },

        paymentMethod: {
            type: String,
            enum: [
                "WALLET",
                "BANK",
                "UPI",
                "CARD",
                "CASH",
            ],
            default: "WALLET",
        },

        amount: {
            type: Number,
            required: true,
        },

        charges: {
            type: Number,
            default: 0,
        },

        gst: {
            type: Number,
            default: 0,
        },

        openingBalance: {
            type: Number,
            required: true,
        },

        closingBalance: {
            type: Number,
            required: true,
        },

        description: {
            type: String,
            trim: true,
        },

        status: {
            type: String,
            enum: [
                "PENDING",
                "SUCCESS",
                "FAILED",
                "CANCELLED",
            ],
            default: "PENDING",
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model(
    "WalletTransaction",
    walletTransactionSchema
);