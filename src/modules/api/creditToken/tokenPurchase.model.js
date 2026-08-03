const mongoose = require("mongoose");

const PAYMENT_METHODS = ["WALLET", "ONLINE", "UPI", "CARD", "NET_BANKING", "CASH"];
const PURCHASE_STATUSES = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"];

const tokenPurchaseSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        partner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Partner",
            default: null,
            index: true,
        },

        tokenPlan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CreditToken",
            required: true,
        },

        planTitle: {
            type: String,
            required: true,
            trim: true,
        },

        tokenType: {
            type: String,
            enum: ["CRIF", "CIBIL", "EXPERIAN"],
            required: true,
            index: true,
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
        },

        price: {
            type: Number,
            required: true,
            min: 0,
        },

        planType: {
            type: String,
            enum: ["NORMAL", "POPULAR"],
            default: "NORMAL",
        },

        paymentMethod: {
            type: String,
            enum: PAYMENT_METHODS,
            default: "WALLET",
            index: true,
        },

        transactionId: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        walletTransaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WalletTransaction",
            default: null,
        },

        // Razorpay fields (used when paymentMethod === ONLINE)
        razorpayOrderId: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        razorpayPaymentId: {
            type: String,
            trim: true,
            default: null,
        },

        razorpaySignature: {
            type: String,
            trim: true,
            default: null,
        },

        failureReason: {
            type: String,
            trim: true,
            default: "",
        },

        status: {
            type: String,
            enum: PURCHASE_STATUSES,
            default: "SUCCESS",
            index: true,
        },

        purchasedAt: {
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

tokenPurchaseSchema.index({ user: 1, purchasedAt: -1 });
tokenPurchaseSchema.index({ partner: 1, purchasedAt: -1 });

module.exports = mongoose.model("TokenPurchase", tokenPurchaseSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.PURCHASE_STATUSES = PURCHASE_STATUSES;
