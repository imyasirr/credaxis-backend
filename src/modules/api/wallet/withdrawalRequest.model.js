const mongoose = require("mongoose");

const WITHDRAWAL_STATUSES = Object.freeze({
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    REJECTED: "REJECTED",
});

const DESTINATION_TYPES = Object.freeze({
    BANK_ACCOUNT: "BANK_ACCOUNT",
    BENEFICIARY: "BENEFICIARY",
});

const bankSnapshotSchema = new mongoose.Schema(
    {
        accountHolderName: { type: String, default: "" },
        bankName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        ifscCode: { type: String, default: "" },
        accountType: { type: String, default: "" },
        nickname: { type: String, default: "" },
    },
    { _id: false }
);

const withdrawalRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true,
            index: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 1,
        },

        currency: {
            type: String,
            default: "INR",
        },

        status: {
            type: String,
            enum: Object.values(WITHDRAWAL_STATUSES),
            default: WITHDRAWAL_STATUSES.PENDING,
            index: true,
        },

        destinationType: {
            type: String,
            enum: Object.values(DESTINATION_TYPES),
            required: true,
        },

        destinationId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        bankSnapshot: {
            type: bankSnapshotSchema,
            required: true,
        },

        /** When user requested */
        requestedAt: {
            type: Date,
            default: Date.now,
        },

        /** Expected settlement (default +48h from request) */
        expectedAt: {
            type: Date,
            default: null,
        },

        processedAt: {
            type: Date,
            default: null,
        },

        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        failureReason: {
            type: String,
            default: "",
            trim: true,
        },

        adminRemark: {
            type: String,
            default: "",
            trim: true,
        },

        /** Placeholder for bank/RazorpayX / payout API */
        provider: {
            type: String,
            default: "MANUAL",
            trim: true,
        },

        providerPayoutId: {
            type: String,
            default: null,
            trim: true,
            sparse: true,
            index: true,
        },

        providerStatus: {
            type: String,
            default: null,
            trim: true,
        },

        providerMeta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },

        walletTransaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WalletTransaction",
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

withdrawalRequestSchema.index({ user: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
module.exports.WITHDRAWAL_STATUSES = WITHDRAWAL_STATUSES;
module.exports.DESTINATION_TYPES = DESTINATION_TYPES;
