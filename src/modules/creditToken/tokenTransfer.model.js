const mongoose = require("mongoose");

const TRANSFER_REASONS = [
    "BONUS",
    "OFFER",
    "WELCOME_GIFT",
    "PROMOTION",
    "ADJUSTMENT",
    "OTHER",
];

const TOKEN_TYPES = ["CRIF", "CIBIL", "EXPERIAN"];

const tokenTransferSchema = new mongoose.Schema(
    {
        partner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Partner",
            required: true,
            index: true,
        },

        partnerUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        transferredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        tokenType: {
            type: String,
            enum: TOKEN_TYPES,
            required: true,
            index: true,
        },

        quantity: {
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

tokenTransferSchema.index({ partner: 1, transferredAt: -1 });
tokenTransferSchema.index({ partnerUser: 1, transferredAt: -1 });

module.exports = mongoose.model("TokenTransfer", tokenTransferSchema);
module.exports.TRANSFER_REASONS = TRANSFER_REASONS;
module.exports.TOKEN_TYPES = TOKEN_TYPES;
