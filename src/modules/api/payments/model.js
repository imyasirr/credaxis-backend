const mongoose = require("mongoose");
const {
    PAYMENT_PURPOSES,
    PAYMENT_STATUSES,
} = require("../../../integrations/razorpay/constants");

const paymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        purpose: {
            type: String,
            enum: Object.values(PAYMENT_PURPOSES),
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
            enum: Object.values(PAYMENT_STATUSES),
            default: PAYMENT_STATUSES.CREATED,
            index: true,
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        razorpayOrderId: {
            type: String,
            trim: true,
            index: true,
            sparse: true,
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

        receipt: {
            type: String,
            trim: true,
            default: null,
        },

        /** Fulfillment result refs (wallet txn id, credit report id, etc.) */
        referenceType: {
            type: String,
            default: null,
        },

        referenceId: {
            type: String,
            default: null,
        },

        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },

        paidAt: {
            type: Date,
            default: null,
        },

        consumedAt: {
            type: Date,
            default: null,
        },

        failureReason: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

paymentSchema.index({ user: 1, purpose: 1, status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
