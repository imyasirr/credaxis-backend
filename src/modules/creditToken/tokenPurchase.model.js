const mongoose = require("mongoose");

const tokenPurchaseSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
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
            enum: ["WALLET", "UPI", "CARD", "NET_BANKING", "CASH"],
            default: "WALLET",
        },

        transactionId: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        status: {
            type: String,
            enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
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

module.exports = mongoose.model("TokenPurchase", tokenPurchaseSchema);
