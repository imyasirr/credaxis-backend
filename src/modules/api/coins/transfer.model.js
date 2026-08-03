const mongoose = require("mongoose");

const TRANSFER_REASONS = [
    "BONUS",
    "OFFER",
    "WELCOME_GIFT",
    "PROMOTION",
    "ADJUSTMENT",
    "OTHER",
];

const coinTransferSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        coinWallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CoinWallet",
            required: true,
            index: true,
        },

        transferredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 1,
        },

        reason: {
            type: String,
            enum: TRANSFER_REASONS,
            required: true,
            index: true,
        },

        note: {
            type: String,
            trim: true,
            default: "",
        },

        transferId: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
        },

        status: {
            type: String,
            enum: ["SUCCESS", "REVERSED"],
            default: "SUCCESS",
            index: true,
        },

        transferredAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

coinTransferSchema.index({ user: 1, transferredAt: -1 });

module.exports = mongoose.model("CoinTransfer", coinTransferSchema);
module.exports.TRANSFER_REASONS = TRANSFER_REASONS;
